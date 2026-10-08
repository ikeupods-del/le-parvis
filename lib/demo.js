/* Données d'exemple (fictives). Elles disparaîtront au fil des phases,
   quand Supabase fournira les vraies données. */
import { isoDay } from './util.js';

export const ROOMS = [
  { id: 'general', name: 'Général', desc: 'Pour se présenter et échanger simplement.' },
  { id: 'priere', name: 'Demandes de prière', desc: "Confiez un sujet, d'autres prieront avec vous." },
  { id: 'foi', name: 'Questions sur la foi', desc: 'Poser une question sincère, sans débat de confession.' }
];

export const SEED = {
  general: [{ id: 'g1', u: 'Marie', t: 'Bonjour à tous, content de découvrir cet espace !' }, { id: 'g2', u: 'Samuel', t: 'Bienvenue. Le plan de lecture sur Jean est un bon début.' }],
  priere: [{ id: 'p1', u: 'Élodie', t: "Merci de prier pour mon père qui entre à l'hôpital demain." }, { id: 'p2', u: 'Marc', t: 'Je pense à vous, Élodie. Courage.' }],
  foi: [{ id: 'f1', u: 'Karim', t: "Par où commencer quand on n'a jamais lu la Bible ?" }, { id: 'f2', u: 'Anne', t: "Beaucoup commencent par l'Évangile de Jean, c'est court et lumineux." }]
};

export const PARTNERS = [
  { c: 'Librairie', n: 'Librairie La Source', d: "Bibles, livres et cartes de vœux. Emplacement d'exemple." },
  { c: 'Café associatif', n: 'Le Café du Parvis', d: "Un lieu d'accueil et de rencontre. Emplacement d'exemple." },
  { c: 'Artisan', n: 'Atelier du Charpentier', d: "Menuiserie et petits objets en bois. Emplacement d'exemple." }
];

export const CHURCHES = [
  { id: 'c1', n: 'Paroisse Saint-Exemple', v: 'Nîmes', f: 'Catholique', h: 'Messe : dimanche 10h30, mercredi 18h30', a: [{ t: 'Veillée de prière', x: "Vendredi à 20h30, ouverte à tous. Exemple d'annonce." }] },
  { id: 'c2', n: 'Église protestante Exemple', v: 'Montpellier', f: 'Protestante', h: 'Culte : dimanche 10h30', a: [{ t: 'Repas partagé', x: "Dimanche après le culte. Exemple d'annonce." }] },
  { id: 'c3', n: 'Communauté évangélique Exemple', v: 'Alès', f: 'Évangélique', h: 'Culte : dimanche 10h', a: [{ t: 'Groupe de maison', x: "Jeudi à 19h30. Exemple d'annonce." }] },
  { id: 'c4', n: 'Paroisse orthodoxe Exemple', v: 'Lyon', f: 'Orthodoxe', h: 'Divine Liturgie : dimanche 9h30', a: [] }
];
export const CONFS = ['Catholique', 'Protestante', 'Évangélique', 'Orthodoxe', 'Autre'];
export const ROLES = ['Prêtre', 'Pasteur', 'Diacre', 'Responsable de communauté', 'Autre responsable'];

export const MAR_NEEDS = ['Café et boissons chaudes', 'Sandwichs et collations', 'Vêtements chauds', 'Couvertures et sacs de couchage', "Kits d'hygiène", 'Chaussettes et sous-vêtements neufs'];
export const SEEDMAR = [
  { id: 'm1', t: 'Maraude du jeudi soir', o: 'Paroisse Saint-Exemple', d: isoDay(2), h: '19:00', p: "Parvis de l'église", c: 'Nîmes', need: 8, got: 5, needs: ['Café et boissons chaudes', 'Sandwichs et collations', 'Couvertures et sacs de couchage'], n: 'Exemple fictif.' },
  { id: 'm2', t: 'Petits-déjeuners solidaires', o: 'Église protestante Exemple', d: isoDay(5), h: '07:30', p: 'Salle paroissiale', c: 'Montpellier', need: 6, got: 2, needs: ['Café et boissons chaudes', "Kits d'hygiène"], n: 'Exemple fictif.' },
  { id: 'm3', t: 'Maraude de quartier', o: "Collectif d'exemple", d: isoDay(9), h: '20:00', p: 'Place de la mairie', c: 'Alès', need: 5, got: 4, needs: ['Vêtements chauds', 'Chaussettes et sous-vêtements neufs'], n: 'Exemple fictif.' }
];

export const SEEDIDEAS = [
  { id: 'i1', t: 'Rappel du verset du jour le matin', v: 14, st: 'Étudié' },
  { id: 'i2', t: 'Plan de lecture du Nouveau Testament', v: 9, st: 'Proposé' },
  { id: 'i3', t: 'Fonctionner sans connexion internet', v: 6, st: 'Proposé' }
];
