# Base de données Parvis (Supabase)

## Contenu
- `migrations/` : les 6 fichiers SQL qui créent les tables, les règles d'accès (RLS) et les fonctions. À appliquer **dans l'ordre des numéros**.
- `tests/` : tests automatiques des règles d'accès. Lancer `npm run test:db` (aucun compte Supabase nécessaire : ils tournent sur une base Postgres embarquée). Ils sont aussi lancés à chaque envoi sur GitHub, avant la mise en ligne.

## Appliquer les migrations sur votre projet Supabase
1. Sur supabase.com, ouvrez votre projet (région UE), puis **SQL Editor** → **New query**.
2. Ouvrez `migrations/20261008000001_profils_roles.sql`, copiez tout son contenu dans l'éditeur, cliquez sur **Run**. Le résultat attendu est « Success. No rows returned ».
3. Recommencez avec les fichiers `…02`, `…03`, `…04`, `…05`, `…06`, dans cet ordre.
4. Ne rejouez jamais un fichier déjà exécuté (il échouerait : les tables existent déjà).

## Nommer un administrateur ou un modérateur
Cela ne se fait jamais depuis l'application. Après votre première connexion Google :
1. **Authentication → Users** : copiez votre identifiant (colonne « UID »).
2. **SQL Editor** : exécutez (en remplaçant l'identifiant) :
   `insert into public.user_roles (user_id, role) values ('VOTRE-UID', 'admin');`
   Pour un modérateur, remplacez `'admin'` par `'moderator'`.

## Ce que protègent les règles
- Carnet de prière, lecture, rappels, notifications, église choisie : visibles par leur seul propriétaire.
- Messages : lisibles par les membres connectés, écriture sous son propre pseudo, avec consentement, sans bannissement, 10 messages par minute au plus.
- Maraudes, idées, demandes de responsable : toujours « en attente » à la création, validées par un administrateur.
- Visiteurs sans compte : lecture seule des communautés, annonces, partenaires actifs et maraudes publiées (sans le nom de l'organisateur).
- `export_my_data()` et `delete_my_account()` : export et suppression complète des données du membre connecté.
