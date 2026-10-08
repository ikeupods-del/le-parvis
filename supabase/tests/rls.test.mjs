// Tests des règles d'accès (RLS) de Parvis. Lancer : npm run test:db
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, mkUser, asUser, asAnon, denied } from './helpers.mjs';

let db;
before(async () => { db = await newDb(); });

const one = async (d, sql, params) => (await d.query(sql, params)).rows;

/* ------------------------------------------------------------------ */
describe('Audit général', () => {
  it('toutes les tables du schéma public ont la RLS activée', async () => {
    const rows = await one(db, `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`);
    assert.deepEqual(rows, [], `tables sans RLS : ${rows.map(r => r.tablename).join(', ')}`);
  });

  it('chaque table a au moins une règle, ou aucun droit pour les clients', async () => {
    // Une table avec RLS mais sans règle est fermée à tous : c'est voulu pour user_roles uniquement si elle a une règle de lecture.
    const rows = await one(db, `
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)`);
    assert.deepEqual(rows, [], `tables sans règle : ${rows.map(r => r.relname).join(', ')}`);
  });

  it("le visiteur sans compte (anon) n'a de droit que sur 4 tables publiques", async () => {
    const rows = await one(db, `
      select table_name from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'
      union
      select table_name from information_schema.column_privileges where grantee = 'anon' and table_schema = 'public'
      order by 1`);
    assert.deepEqual(rows.map(r => r.table_name), ['church_announcements', 'churches', 'maraudes', 'partners']);
  });

  it("les fonctions sensibles ne sont pas appelables par anon", async () => {
    const anonCanCall = ['is_admin', 'is_moderator', 'has_consent', 'accept_consent', 'export_my_data',
      'delete_my_account', 'approve_manager_request', 'purge_old_messages', 'idea_vote_counts'];
    for (const f of anonCanCall) {
      const [{ ok }] = await one(db, `select bool_or(has_function_privilege('anon', p.oid, 'execute')) as ok from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [f]);
      assert.equal(ok, false, `${f} est appelable par anon`);
    }
  });

  it('les fonctions de maintenance ne sont appelables par personne côté client', async () => {
    for (const f of ['purge_old_messages', 'handle_new_user', 'messages_before_insert', 'reports_before_insert']) {
      const [{ ok }] = await one(db, `select bool_or(has_function_privilege('authenticated', p.oid, 'execute')) as ok from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [f]);
      assert.equal(ok, false, `${f} est appelable par un membre`);
    }
  });
});

/* ------------------------------------------------------------------ */
describe('Profils, consentement et rôles', () => {
  it('un profil est créé automatiquement pour chaque nouveau membre', async () => {
    const u = await mkUser(db);
    const rows = await one(db, 'select id from public.profiles where id = $1', [u]);
    assert.equal(rows.length, 1);
  });

  it('un membre ne lit que son propre profil', async () => {
    const a = await mkUser(db, { pseudo: 'Alice' });
    const b = await mkUser(db, { pseudo: 'Bob' });
    const rows = await asUser(db, a, d => one(d, 'select id, pseudo from public.profiles'));
    assert.deepEqual(rows.map(r => r.id), [a]);
    assert.ok(!rows.some(r => r.id === b));
  });

  it("un membre peut changer son pseudo, pas celui d'un autre", async () => {
    const a = await mkUser(db, { pseudo: 'Alice' });
    const b = await mkUser(db, { pseudo: 'Bob' });
    await asUser(db, a, d => d.query("update public.profiles set pseudo = 'Alice2' where id = $1", [a]));
    const changed = await asUser(db, a, d => d.query("update public.profiles set pseudo = 'Piraté' where id = $1", [b]));
    assert.equal(changed.affectedRows, 0);
    const [{ pseudo }] = await one(db, 'select pseudo from public.profiles where id = $1', [b]);
    assert.equal(pseudo, 'Bob');
  });

  it('un membre ne peut pas écrire son consentement directement', async () => {
    const a = await mkUser(db);
    await denied(asUser(db, a, d => d.query('update public.profiles set consent_at = now() where id = $1', [a])));
  });

  it('accept_consent enregistre le consentement du membre connecté seulement', async () => {
    const a = await mkUser(db);
    const b = await mkUser(db);
    await asUser(db, a, d => d.query("select public.accept_consent('2026-10')"));
    const [pa] = await one(db, 'select consent_at, consent_version from public.profiles where id = $1', [a]);
    const [pb] = await one(db, 'select consent_at from public.profiles where id = $1', [b]);
    assert.ok(pa.consent_at);
    assert.equal(pa.consent_version, '2026-10');
    assert.equal(pb.consent_at, null);
  });

  it('withdraw_consent retire le consentement', async () => {
    const a = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query('select public.withdraw_consent()'));
    const [p] = await one(db, 'select consent_at from public.profiles where id = $1', [a]);
    assert.equal(p.consent_at, null);
  });

  it('un membre ne peut pas se donner un rôle de modérateur ou d\'administrateur', async () => {
    const a = await mkUser(db);
    await denied(asUser(db, a, d => d.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [a])));
    const [{ n }] = await one(db, 'select count(*)::int n from public.user_roles where user_id = $1', [a]);
    assert.equal(n, 0);
  });

  it('un visiteur sans compte ne lit ni profils ni rôles', async () => {
    await denied(asAnon(db, d => d.query('select * from public.profiles')));
    await denied(asAnon(db, d => d.query('select * from public.user_roles')));
  });

  it('un membre ne voit que ses propres rôles', async () => {
    const admin = await mkUser(db, { role: 'admin' });
    const a = await mkUser(db);
    const rows = await asUser(db, a, d => one(d, 'select * from public.user_roles'));
    assert.deepEqual(rows, []);
    const mine = await asUser(db, admin, d => one(d, 'select role from public.user_roles'));
    assert.deepEqual(mine.map(r => r.role), ['admin']);
  });
});

/* ------------------------------------------------------------------ */
describe('Carnet de prière et données privées', () => {
  it("chaque membre ne voit que son carnet", async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query("insert into public.prayers (type, body) values ('demande', 'secret de A')"));
    const vuParB = await asUser(db, b, d => one(d, 'select * from public.prayers'));
    assert.deepEqual(vuParB, []);
    const vuParA = await asUser(db, a, d => one(d, 'select body from public.prayers'));
    assert.deepEqual(vuParA.map(r => r.body), ['secret de A']);
  });

  it("on ne peut pas écrire une prière au nom d'un autre", async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    await denied(asUser(db, a, d => d.query("insert into public.prayers (user_id, type, body) values ($1, 'demande', 'x')", [b])));
  });

  it("sans consentement, on ne peut rien écrire", async () => {
    const a = await mkUser(db);
    await denied(asUser(db, a, d => d.query("insert into public.prayers (type, body) values ('demande', 'x')")));
    await denied(asUser(db, a, d => d.query("insert into public.reading_progress (plan_id, day_index) values ('jean', 0)")));
    await denied(asUser(db, a, d => d.query("insert into public.reminders (kind, at_time) values ('verse', '08:00')")));
  });

  it("on ne modifie ni ne supprime la prière d'un autre", async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    const [{ id }] = await asUser(db, a, d => one(d, "insert into public.prayers (type, body) values ('merci', 'à moi') returning id"));
    const upd = await asUser(db, b, d => d.query("update public.prayers set body = 'volé' where id = $1", [id]));
    const del = await asUser(db, b, d => d.query('delete from public.prayers where id = $1', [id]));
    assert.equal(upd.affectedRows, 0);
    assert.equal(del.affectedRows, 0);
    const [{ body }] = await one(db, 'select body from public.prayers where id = $1', [id]);
    assert.equal(body, 'à moi');
  });

  it("un visiteur sans compte n'accède à aucune donnée privée", async () => {
    for (const t of ['prayers', 'reading_progress', 'user_settings', 'reminders', 'push_subscriptions']) {
      await denied(asAnon(db, d => d.query(`select * from public.${t}`)));
    }
  });

  it('la progression de lecture est privée', async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query("insert into public.reading_progress (plan_id, day_index) values ('jean', 0), ('jean', 1)"));
    assert.equal((await asUser(db, b, d => one(d, 'select * from public.reading_progress'))).length, 0);
    assert.equal((await asUser(db, a, d => one(d, 'select * from public.reading_progress'))).length, 2);
  });

  it("le membre ne peut pas truquer la date du dernier envoi d'un rappel", async () => {
    const a = await mkUser(db, { consent: true });
    const [{ id }] = await asUser(db, a, d => one(d, "insert into public.reminders (kind, at_time, last_sent) values ('prayer', '21:00', '2026-01-01') returning id"));
    await asUser(db, a, d => d.query("update public.reminders set last_sent = '2026-02-02', label = 'Soir' where id = $1", [id]));
    const [r] = await one(db, 'select last_sent, label from public.reminders where id = $1', [id]);
    assert.equal(r.last_sent, null);
    assert.equal(r.label, 'Soir');
  });

  it('un seul rappel de verset par membre', async () => {
    const a = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query("insert into public.reminders (kind, at_time) values ('verse', '08:00')"));
    await denied(asUser(db, a, d => d.query("insert into public.reminders (kind, at_time) values ('verse', '09:00')")));
  });

  it('les abonnements de notification sont privés', async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query("insert into public.push_subscriptions (endpoint, p256dh, auth_key) values ('https://push.exemple/abc', 'k', 'a')"));
    assert.equal((await asUser(db, b, d => one(d, 'select * from public.push_subscriptions'))).length, 0);
  });
});

/* ------------------------------------------------------------------ */
describe('Salons et modération', () => {
  async function msg(user, text = 'Bonjour') {
    return asUser(db, user, d => one(d, "insert into public.messages (room_id, body) values ('general', $1) returning id, pseudo, user_id", [text]));
  }

  it('un membre avec consentement et pseudo peut écrire ; le pseudo est imposé par le serveur', async () => {
    const a = await mkUser(db, { pseudo: 'Alice', consent: true });
    const [m] = await asUser(db, a, d => one(d, "insert into public.messages (room_id, body, pseudo) values ('general', 'Salut', 'Usurpateur') returning pseudo, user_id"));
    assert.equal(m.pseudo, 'Alice');
    assert.equal(m.user_id, a);
  });

  it("sans consentement ou sans pseudo, l'écriture est refusée", async () => {
    const sansConsent = await mkUser(db, { pseudo: 'X' });
    const sansPseudo = await mkUser(db, { consent: true });
    await denied(msg(sansConsent));
    await denied(msg(sansPseudo), /pseudo requis/);
  });

  it("on ne peut pas écrire sous le nom d'un autre", async () => {
    const a = await mkUser(db, { pseudo: 'A', consent: true });
    const b = await mkUser(db, { pseudo: 'B', consent: true });
    await denied(asUser(db, a, d => d.query("insert into public.messages (room_id, user_id, body) values ('general', $1, 'faux')", [b])));
  });

  it('un membre banni ne peut plus écrire, un bannissement expiré ne compte plus', async () => {
    const a = await mkUser(db, { pseudo: 'Banni', consent: true });
    await db.query("insert into public.bans (user_id, until) values ($1, now() + interval '1 day')", [a]);
    await denied(msg(a));
    await db.query("update public.bans set until = now() - interval '1 minute' where user_id = $1", [a]);
    await msg(a);
  });

  it('un message de plus de 400 caractères est refusé', async () => {
    const a = await mkUser(db, { pseudo: 'Long', consent: true });
    await denied(msg(a, 'x'.repeat(401)));
  });

  it('limite de débit : au plus 10 messages par minute', async () => {
    const a = await mkUser(db, { pseudo: 'Spam', consent: true });
    for (let i = 0; i < 10; i++) await msg(a, `m${i}`);
    await denied(msg(a, 'de trop'), /trop de messages/);
  });

  it('les messages sont lisibles par les membres connectés, pas par les visiteurs', async () => {
    const a = await mkUser(db, { pseudo: 'Lu', consent: true });
    const b = await mkUser(db);
    const [{ id }] = await msg(a, 'visible');
    const vu = await asUser(db, b, d => one(d, 'select id from public.messages where id = $1', [id]));
    assert.equal(vu.length, 1);
    await denied(asAnon(db, d => d.query('select * from public.messages')));
  });

  it("les messages d'une personne bloquée disparaissent pour celui qui l'a bloquée", async () => {
    const a = await mkUser(db, { pseudo: 'Auteur', consent: true });
    const b = await mkUser(db, { consent: true });
    const c = await mkUser(db, { consent: true });
    const [{ id }] = await msg(a, 'à masquer');
    await asUser(db, b, d => d.query('insert into public.blocks (blocked_id) values ($1)', [a]));
    assert.equal((await asUser(db, b, d => one(d, 'select id from public.messages where id = $1', [id]))).length, 0);
    assert.equal((await asUser(db, c, d => one(d, 'select id from public.messages where id = $1', [id]))).length, 1);
  });

  it('les blocages sont privés', async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    const c = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query('insert into public.blocks (blocked_id) values ($1)', [b]));
    assert.equal((await asUser(db, c, d => one(d, 'select * from public.blocks'))).length, 0);
    await denied(asUser(db, a, d => d.query('insert into public.blocks (blocked_id) values ($1)', [a])));
  });

  it("seul l'auteur ou un modérateur supprime un message ; personne ne modifie", async () => {
    const a = await mkUser(db, { pseudo: 'A', consent: true });
    const b = await mkUser(db, { consent: true });
    const mod = await mkUser(db, { role: 'moderator' });
    const [{ id }] = await msg(a, 'à supprimer');
    const parB = await asUser(db, b, d => d.query('delete from public.messages where id = $1', [id]));
    assert.equal(parB.affectedRows, 0);
    await denied(asUser(db, a, d => d.query("update public.messages set body = 'modifié' where id = $1", [id])));
    const parMod = await asUser(db, mod, d => d.query('delete from public.messages where id = $1', [id]));
    assert.equal(parMod.affectedRows, 1);
  });

  it('un signalement garde une copie du message, non falsifiable', async () => {
    const a = await mkUser(db, { pseudo: 'Fautif', consent: true });
    const r = await mkUser(db, { consent: true });
    const [{ id }] = await msg(a, 'contenu litigieux');
    const [rep] = await asUser(db, r, d => one(d, `insert into public.reports (message_id, message_body, message_pseudo, reason)
      values ($1, 'texte truqué', 'autre', 'insultes') returning id, message_body, message_pseudo, message_user_id`, [id]));
    assert.equal(rep.message_body, 'contenu litigieux');
    assert.equal(rep.message_pseudo, 'Fautif');
    assert.equal(rep.message_user_id, a);
    await db.query('delete from public.messages where id = $1', [id]);
    const [kept] = await one(db, 'select message_body from public.reports where id = $1', [rep.id]);
    assert.equal(kept.message_body, 'contenu litigieux');
  });

  it('les signalements ne sont lisibles que par leur auteur et les modérateurs', async () => {
    const a = await mkUser(db, { pseudo: 'A', consent: true });
    const r = await mkUser(db, { consent: true });
    const autre = await mkUser(db, { consent: true });
    const mod = await mkUser(db, { role: 'moderator' });
    const [{ id }] = await msg(a, 'x');
    await asUser(db, r, d => d.query('insert into public.reports (message_id) values ($1)', [id]));
    assert.equal((await asUser(db, r, d => one(d, 'select id from public.reports'))).length, 1);
    assert.equal((await asUser(db, autre, d => one(d, 'select id from public.reports'))).length, 0);
    assert.equal((await asUser(db, a, d => one(d, 'select id from public.reports'))).length, 0);
    assert.ok((await asUser(db, mod, d => one(d, 'select id from public.reports'))).length >= 1);
  });

  it('un membre ordinaire ne traite pas les signalements et ne bannit personne', async () => {
    const a = await mkUser(db, { pseudo: 'A', consent: true });
    const r = await mkUser(db, { consent: true });
    const [{ id }] = await msg(a, 'x');
    const [{ id: rid }] = await asUser(db, r, d => one(d, 'insert into public.reports (message_id) values ($1) returning id', [id]));
    const upd = await asUser(db, r, d => d.query("update public.reports set status = 'handled' where id = $1", [rid]));
    assert.equal(upd.affectedRows, 0);
    await denied(asUser(db, r, d => d.query('insert into public.bans (user_id) values ($1)', [a])));
    const mod = await mkUser(db, { role: 'moderator' });
    await asUser(db, mod, d => d.query('insert into public.bans (user_id, reason) values ($1, $2)', [a, 'test']));
  });

  it('la purge supprime les messages de plus de 7 jours et seulement ceux-là', async () => {
    const a = await mkUser(db, { pseudo: 'Vieux', consent: true });
    const [{ id: vieux }] = await msg(a, 'ancien');
    const [{ id: recent }] = await msg(a, 'récent');
    await db.query("update public.messages set created_at = now() - interval '8 days' where id = $1", [vieux]);
    const [{ purge_old_messages: n }] = await one(db, 'select public.purge_old_messages()');
    assert.ok(n >= 1);
    assert.equal((await one(db, 'select id from public.messages where id = $1', [vieux])).length, 0);
    assert.equal((await one(db, 'select id from public.messages where id = $1', [recent])).length, 1);
    const b = await mkUser(db, { consent: true });
    await denied(asUser(db, b, d => d.query('select public.purge_old_messages()')));
  });

  it('les salons sont lisibles seulement par les membres connectés', async () => {
    const a = await mkUser(db);
    assert.equal((await asUser(db, a, d => one(d, 'select * from public.rooms'))).length, 3);
    await denied(asAnon(db, d => d.query('select * from public.rooms')));
  });
});

/* ------------------------------------------------------------------ */
describe('Mon église et demandes de responsable', () => {
  const demande = (extra = '') => `insert into public.manager_requests
    (full_name, role, church_name, city, confession, official_email, verify_link${extra ? ', ' + extra.split('=')[0] : ''})
    values ('Jean Dupont', 'Pasteur', 'Église du test', 'Nîmes', 'Protestante', 'contact@test.fr', 'https://test.fr/page'${extra ? ', ' + extra.split('=')[1] : ''})
    returning id`;

  it("l'annuaire des communautés est public, sans écriture pour les visiteurs ni les membres", async () => {
    const a = await mkUser(db, { consent: true });
    await db.query("insert into public.churches (name, city, confession) values ('Paroisse test', 'Lyon', 'Catholique')");
    assert.ok((await asAnon(db, d => one(d, 'select * from public.churches'))).length >= 1);
    await denied(asAnon(db, d => d.query("insert into public.churches (name, city, confession) values ('x', 'y', 'Autre')")));
    await denied(asUser(db, a, d => d.query("insert into public.churches (name, city, confession) values ('Fausse', 'Ville', 'Autre')")));
  });

  it('un membre peut faire une demande, mais pas se déclarer déjà validé', async () => {
    const a = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query(demande()));
    const b = await mkUser(db, { consent: true });
    await denied(asUser(db, b, d => d.query(demande("status='approved'"))));
  });

  it('une seule demande en attente par membre', async () => {
    const a = await mkUser(db, { consent: true });
    await asUser(db, a, d => d.query(demande()));
    await denied(asUser(db, a, d => d.query(demande())));
  });

  it("une demande n'est lisible que par son auteur et l'administrateur", async () => {
    const a = await mkUser(db, { consent: true });
    const autre = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    await asUser(db, a, d => d.query(demande()));
    assert.equal((await asUser(db, a, d => one(d, 'select * from public.manager_requests'))).length, 1);
    assert.equal((await asUser(db, autre, d => one(d, 'select * from public.manager_requests'))).length, 0);
    assert.ok((await asUser(db, admin, d => one(d, 'select * from public.manager_requests'))).length >= 1);
    await denied(asAnon(db, d => d.query('select * from public.manager_requests')));
  });

  it("seul l'administrateur valide une demande ; la validation crée la communauté et nomme le responsable", async () => {
    const a = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const [{ id }] = await asUser(db, a, d => one(d, demande()));
    await denied(asUser(db, a, d => d.query('select public.approve_manager_request($1)', [id])), /réservé/);
    const [{ approve_manager_request: churchId }] = await asUser(db, admin, d => one(d, 'select public.approve_manager_request($1)', [id]));
    const [c] = await one(db, 'select name from public.churches where id = $1', [churchId]);
    assert.equal(c.name, 'Église du test');
    assert.equal((await one(db, 'select * from public.church_managers where user_id = $1 and church_id = $2', [a, churchId])).length, 1);
    const [r] = await one(db, 'select status from public.manager_requests where id = $1', [id]);
    assert.equal(r.status, 'approved');
    await denied(asUser(db, admin, d => d.query('select public.approve_manager_request($1)', [id])), /déjà traitée/);
  });

  it("le rejet est réservé à l'administrateur", async () => {
    const a = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const [{ id }] = await asUser(db, a, d => one(d, demande()));
    await denied(asUser(db, a, d => d.query('select public.reject_manager_request($1)', [id])), /réservé/);
    await asUser(db, admin, d => d.query('select public.reject_manager_request($1)', [id]));
    const [r] = await one(db, 'select status from public.manager_requests where id = $1', [id]);
    assert.equal(r.status, 'rejected');
  });

  it("un responsable publie des annonces et change les horaires de SA communauté, pas d'une autre", async () => {
    const resp = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const [{ id }] = await asUser(db, resp, d => one(d, demande()));
    const [{ approve_manager_request: mine }] = await asUser(db, admin, d => one(d, 'select public.approve_manager_request($1)', [id]));
    const [{ id: other }] = await one(db, "insert into public.churches (name, city, confession) values ('Autre église', 'Lyon', 'Catholique') returning id");

    await asUser(db, resp, d => d.query("insert into public.church_announcements (church_id, title, body) values ($1, 'Veillée', 'Vendredi 20h')", [mine]));
    await denied(asUser(db, resp, d => d.query("insert into public.church_announcements (church_id, title, body) values ($1, 'Intrus', 'x')", [other])));

    await asUser(db, resp, d => d.query("update public.churches set hours = 'Dimanche 10h', name = 'Renommée !' where id = $1", [mine]));
    const [c] = await one(db, 'select name, hours from public.churches where id = $1', [mine]);
    assert.equal(c.hours, 'Dimanche 10h');
    assert.equal(c.name, 'Église du test', 'le nom ne doit pas changer');
    const upd = await asUser(db, resp, d => d.query("update public.churches set hours = 'piraté' where id = $1", [other]));
    assert.equal(upd.affectedRows, 0);
  });

  it("un membre ordinaire ne publie pas d'annonce et ne se nomme pas responsable", async () => {
    const a = await mkUser(db, { consent: true });
    const [{ id: ch }] = await one(db, "insert into public.churches (name, city, confession) values ('Cible', 'Paris', 'Autre') returning id");
    await denied(asUser(db, a, d => d.query("insert into public.church_announcements (church_id, title, body) values ($1, 't', 'b')", [ch])));
    await denied(asUser(db, a, d => d.query('insert into public.church_managers (user_id, church_id) values ($1, $2)', [a, ch])));
  });

  it("l'église choisie est privée", async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    const [{ id: ch }] = await one(db, "insert into public.churches (name, city, confession) values ('Choisie', 'Nice', 'Autre') returning id");
    await asUser(db, a, d => d.query('insert into public.user_church (church_id) values ($1)', [ch]));
    assert.equal((await asUser(db, b, d => one(d, 'select * from public.user_church'))).length, 0);
  });
});

/* ------------------------------------------------------------------ */
describe('Maraudes', () => {
  const demain = "now() + interval '1 day'";
  const proposer = (user, extra = '') => asUser(db, user, d => one(d, `insert into public.maraudes (title, starts_at, place, city, volunteers_needed${extra ? ', ' + extra.split('=')[0] : ''})
    values ('Maraude test', ${demain}, 'Parvis', 'Nîmes', 2${extra ? ', ' + extra.split('=')[1] : ''}) returning id`));

  it("une proposition est en attente, invisible des autres et des visiteurs", async () => {
    const o = await mkUser(db, { consent: true });
    const autre = await mkUser(db, { consent: true });
    const [{ id }] = await proposer(o);
    assert.equal((await asUser(db, o, d => one(d, 'select id from public.maraudes where id = $1', [id]))).length, 1);
    assert.equal((await asUser(db, autre, d => one(d, 'select id from public.maraudes where id = $1', [id]))).length, 0);
    assert.equal((await asAnon(db, d => one(d, 'select id from public.maraudes where id = $1', [id]))).length, 0);
  });

  it("l'organisateur ne peut pas publier sa propre maraude", async () => {
    const o = await mkUser(db, { consent: true });
    await denied(proposer(o, "status='published'"));
    const [{ id }] = await proposer(o);
    await denied(asUser(db, o, d => d.query("update public.maraudes set status = 'published' where id = $1", [id])));
  });

  it("une maraude dans le passé est refusée", async () => {
    const o = await mkUser(db, { consent: true });
    await denied(asUser(db, o, d => d.query("insert into public.maraudes (title, starts_at, place, city) values ('t', now() - interval '1 day', 'p', 'c')")));
  });

  it("l'administrateur publie ; les visiteurs la voient, sans l'identité de l'organisateur", async () => {
    const o = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const [{ id }] = await proposer(o);
    await asUser(db, admin, d => d.query("update public.maraudes set status = 'published' where id = $1", [id]));
    const vu = await asAnon(db, d => one(d, 'select id, title from public.maraudes where id = $1', [id]));
    assert.equal(vu.length, 1);
    await denied(asAnon(db, d => d.query('select organizer_id from public.maraudes')));
    await denied(asAnon(db, d => d.query('select * from public.maraudes')));
  });

  it("l'inscription exige une maraude publiée, et respecte le nombre de places", async () => {
    const o = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const v1 = await mkUser(db, { consent: true });
    const v2 = await mkUser(db, { consent: true });
    const v3 = await mkUser(db, { consent: true });
    const [{ id }] = await proposer(o);
    await denied(asUser(db, v1, d => d.query('insert into public.maraude_signups (maraude_id) values ($1)', [id])));
    await asUser(db, admin, d => d.query("update public.maraudes set status = 'published' where id = $1", [id]));
    await asUser(db, v1, d => d.query("insert into public.maraude_signups (maraude_id, bringing) values ($1, '{Café}')", [id]));
    await asUser(db, v2, d => d.query('insert into public.maraude_signups (maraude_id) values ($1)', [id]));
    await denied(asUser(db, v3, d => d.query('insert into public.maraude_signups (maraude_id) values ($1)', [id])));
    const [{ volunteers }] = await asAnon(db, d => one(d, 'select volunteers from public.maraude_counts() where maraude_id = $1', [id]));
    assert.equal(Number(volunteers), 2);
  });

  it("les inscriptions sont privées : on ne voit que la sienne", async () => {
    const o = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const v1 = await mkUser(db, { consent: true });
    const v2 = await mkUser(db, { consent: true });
    const [{ id }] = await proposer(o);
    await asUser(db, admin, d => d.query("update public.maraudes set status = 'published' where id = $1", [id]));
    await asUser(db, v1, d => d.query('insert into public.maraude_signups (maraude_id) values ($1)', [id]));
    assert.equal((await asUser(db, v2, d => one(d, 'select * from public.maraude_signups'))).length, 0);
    assert.equal((await asUser(db, o, d => one(d, 'select * from public.maraude_signups'))).length, 0);
    await denied(asAnon(db, d => d.query('select * from public.maraude_signups')));
  });

  it("personne d'autre ne modifie ni ne supprime la maraude d'un organisateur", async () => {
    const o = await mkUser(db, { consent: true });
    const autre = await mkUser(db, { consent: true });
    const [{ id }] = await proposer(o);
    assert.equal((await asUser(db, autre, d => d.query("update public.maraudes set title = 'volée' where id = $1", [id]))).affectedRows, 0);
    assert.equal((await asUser(db, autre, d => d.query('delete from public.maraudes where id = $1', [id]))).affectedRows, 0);
    assert.equal((await asUser(db, o, d => d.query('delete from public.maraudes where id = $1', [id]))).affectedRows, 1);
  });
});

/* ------------------------------------------------------------------ */
describe('Boîte à idées', () => {
  const proposer = (user, titre = 'Une idée') => asUser(db, user, d => one(d, 'insert into public.ideas (title) values ($1) returning id', [titre]));

  it("une idée est invisible des autres tant qu'elle n'est pas relue", async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    const [{ id }] = await proposer(a);
    assert.equal((await asUser(db, a, d => one(d, 'select id from public.ideas where id = $1', [id]))).length, 1);
    assert.equal((await asUser(db, b, d => one(d, 'select id from public.ideas where id = $1', [id]))).length, 0);
    await denied(asAnon(db, d => d.query('select * from public.ideas')));
  });

  it("l'auteur ne peut pas valider sa propre idée", async () => {
    const a = await mkUser(db, { consent: true });
    const [{ id }] = await proposer(a);
    await denied(asUser(db, a, d => d.query("insert into public.ideas (title, status) values ('x', 'proposed')")));
    const upd = await asUser(db, a, d => d.query("update public.ideas set status = 'proposed' where id = $1", [id]));
    assert.equal(upd.affectedRows, 0);
  });

  it("l'administrateur valide ; alors tous les membres la voient et peuvent voter une fois", async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const [{ id }] = await proposer(a);
    await denied(asUser(db, b, d => d.query('insert into public.idea_votes (idea_id) values ($1)', [id])));
    await asUser(db, admin, d => d.query("update public.ideas set status = 'proposed' where id = $1", [id]));
    assert.equal((await asUser(db, b, d => one(d, 'select id from public.ideas where id = $1', [id]))).length, 1);
    await asUser(db, b, d => d.query('insert into public.idea_votes (idea_id) values ($1)', [id]));
    await denied(asUser(db, b, d => d.query('insert into public.idea_votes (idea_id) values ($1)', [id])));
    await asUser(db, a, d => d.query('insert into public.idea_votes (idea_id) values ($1)', [id]));
    const [{ votes }] = await asUser(db, b, d => one(d, 'select votes from public.idea_vote_counts() where idea_id = $1', [id]));
    assert.equal(Number(votes), 2);
  });

  it('les votes sont privés', async () => {
    const a = await mkUser(db, { consent: true });
    const b = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    const [{ id }] = await proposer(a);
    await asUser(db, admin, d => d.query("update public.ideas set status = 'proposed' where id = $1", [id]));
    await asUser(db, a, d => d.query('insert into public.idea_votes (idea_id) values ($1)', [id]));
    assert.equal((await asUser(db, b, d => one(d, 'select * from public.idea_votes'))).length, 0);
  });
});

/* ------------------------------------------------------------------ */
describe('Partenaires', () => {
  it("tout le monde lit les partenaires actifs ; seul l'administrateur écrit", async () => {
    const a = await mkUser(db, { consent: true });
    const admin = await mkUser(db, { role: 'admin' });
    await asUser(db, admin, d => d.query("insert into public.partners (category, name) values ('Librairie', 'Actif')"));
    await asUser(db, admin, d => d.query("insert into public.partners (category, name, active) values ('Café', 'Caché', false)"));
    const publics = await asAnon(db, d => one(d, 'select name from public.partners'));
    assert.deepEqual(publics.map(p => p.name), ['Actif']);
    await denied(asUser(db, a, d => d.query("insert into public.partners (category, name) values ('Pub', 'Intrus')")));
    await denied(asAnon(db, d => d.query("insert into public.partners (category, name) values ('Pub', 'Intrus')")));
  });

  it("l'adresse d'un partenaire doit être en https", async () => {
    const admin = await mkUser(db, { role: 'admin' });
    await denied(asUser(db, admin, d => d.query("insert into public.partners (category, name, url) values ('x', 'y', 'javascript:alert(1)')")));
  });
});

/* ------------------------------------------------------------------ */
describe('Export et suppression du compte (RGPD)', () => {
  it("l'export contient les données du membre, et seulement les siennes", async () => {
    const a = await mkUser(db, { pseudo: 'Exportée', consent: true });
    const b = await mkUser(db, { pseudo: 'Autre', consent: true });
    await asUser(db, a, d => d.query("insert into public.prayers (type, body) values ('demande', 'prière de A')"));
    await asUser(db, b, d => d.query("insert into public.prayers (type, body) values ('demande', 'prière de B')"));
    const [{ export_my_data: out }] = await asUser(db, a, d => one(d, 'select public.export_my_data()'));
    const texte = JSON.stringify(out);
    assert.ok(texte.includes('prière de A'));
    assert.ok(!texte.includes('prière de B'));
    assert.equal(out.profil.pseudo, 'Exportée');
    await denied(asAnon(db, d => d.query('select public.export_my_data()')));
  });

  it('la suppression du compte efface toutes les données du membre, et pas celles des autres', async () => {
    const a = await mkUser(db, { pseudo: 'Partante', consent: true });
    const b = await mkUser(db, { pseudo: 'Reste', consent: true });
    await asUser(db, a, d => d.query("insert into public.prayers (type, body) values ('demande', 'à effacer')"));
    await asUser(db, a, d => d.query("insert into public.messages (room_id, body) values ('general', 'message à effacer')"));
    await asUser(db, a, d => d.query("insert into public.reading_progress (plan_id, day_index) values ('jean', 3)"));
    await asUser(db, a, d => d.query("insert into public.reminders (kind, at_time) values ('verse', '08:00')"));
    await asUser(db, b, d => d.query("insert into public.prayers (type, body) values ('demande', 'à garder')"));

    await asUser(db, a, d => d.query('select public.delete_my_account()'));

    for (const [t, col] of [['profiles', 'id'], ['prayers', 'user_id'], ['messages', 'user_id'], ['reading_progress', 'user_id'], ['reminders', 'user_id']]) {
      const [{ n }] = await one(db, `select count(*)::int n from public.${t} where ${col} = $1`, [a]);
      assert.equal(n, 0, `${t} contient encore des données du compte supprimé`);
    }
    const [{ n }] = await one(db, 'select count(*)::int n from public.prayers where user_id = $1', [b]);
    assert.equal(n, 1);
    await denied(asAnon(db, d => d.query('select public.delete_my_account()')));
  });
});
