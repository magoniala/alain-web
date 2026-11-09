-- ============================================================
-- Plataforma /magia-tailerrak: catálogo editable desde /admin (2026-11-09)
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente: crea las tablas
-- y carga el catálogo inicial solo si no existe (ON CONFLICT DO NOTHING).
-- Sustituye a magia_bideoak.sql (nunca ejecutado).
-- ============================================================
--
-- Mientras estas tablas no existan o estén vacías, la plataforma usa el
-- catálogo escrito en lib/magia-catalogo.ts. En cuanto haya filas, mandan
-- las filas: todo se edita en /admin › Magia-tailerrak.

CREATE TABLE IF NOT EXISTS magia_liburutxoak (
  slug       text PRIMARY KEY,            -- 6-7 | 8-10 | 11 | los que se añadan
  etiketa    text NOT NULL,               -- «6-7 urte»
  ordena     int  NOT NULL DEFAULT 0,
  ikusgai    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cada pieza de la plataforma: un juego de un librillo, el regalo, un secreto…
--  mota:   jolasa (juego con texto) · oparia (extra) · sekretua (bloque «???»)
--  egoera: irekia (abierto a quien tiene el librillo) · emaila (se abre dejando
--          el email) · ordainpekoa (de pago; aún sin forma de pagar: candado)
--          · sekretua (candado «???», sin pista)
--  liburutxoak: en qué librillos sale; vacío = en todos.
CREATE TABLE IF NOT EXISTS magia_edukiak (
  slug        text PRIMARY KEY,
  mota        text NOT NULL DEFAULT 'jolasa' CHECK (mota IN ('jolasa', 'oparia', 'sekretua')),
  egoera      text NOT NULL DEFAULT 'irekia' CHECK (egoera IN ('irekia', 'emaila', 'ordainpekoa', 'sekretua')),
  izenburua   text NOT NULL,
  etiketa     text,                        -- «Kartekin magia»
  sarrera     text,                        -- qué ve el público
  materiala   text,                        -- «Behar duzuna»
  youtube     text,                        -- id de 11 caracteres; null = «Laster: bideoa»
  liburutxoak text[] NOT NULL DEFAULT '{}',
  ordena      int  NOT NULL DEFAULT 0,
  ikusgai     boolean NOT NULL DEFAULT true,
  prezioa_cent int,                        -- solo ordainpekoa, para cuando haya pago
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE magia_liburutxoak ENABLE ROW LEVEL SECURITY;
ALTER TABLE magia_edukiak    ENABLE ROW LEVEL SECURITY;

-- ---------- Catálogo inicial (los librillos impresos del 7-nov) ----------
INSERT INTO magia_liburutxoak (slug, etiketa, ordena) VALUES
  ('6-7',  '6-7 urte',  1),
  ('8-10', '8-10 urte', 2),
  ('11',   '+11 urte',  3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO magia_edukiak (slug, mota, egoera, izenburua, etiketa, sarrera, materiala, youtube, liburutxoak, ordena) VALUES
  ('opari-basoa', 'oparia', 'emaila', 'Ustekabeko desagerpena', 'Opari extra bat', 'Edalontzi bat. Aluminio papera. Hiru minutu.', NULL, 'YeVxIkatxlw', '{}', 0),
  ('estrella', 'jolasa', 'irekia', 'Makiltxo-izarra', 'Fisika magikoa', 'Hau ez da trikimailu bat: fisika magikoa da! Apustu bat egin: bost makiltxo izar bihurtzea, inork ezerekin bultzatu gabe.', '5 egurrezko makiltxo · ur-tanta bat (baso edo ontzi txiki batean)', NULL, '{6-7,8-10}', 10),
  ('vaso', 'jolasa', 'irekia', 'Txanpona desagertu', 'Diruarekin magia', 'Magoak txanpon bat baso batekin estaltzean, desagertu egiten da. Basoa kentzean, berriz agertzen da.', 'plastikozko baso bat · paper zuria · pegamentua · txanpon bat (edo marrazki bat) · orri zuri bat mahai gisa', NULL, '{6-7}', 20),
  ('emakume', 'jolasa', 'irekia', 'Emakume moztua', 'Magia klasikoa', 'Magiaren klasiko bat, txikian: emakumea kutxa batean sartu eta erditik zeharkatzen dute... eta osorik ateratzen da! Hemen, billetea da emakumea, post-ita kutxa eta boligrafoa ezpata.', 'billete bat edo, bestela, billete baten tamainako paper zati bat, laguntzaile eder bat marraztuta · post-it bat · boligrafo edo arkatz bat', NULL, '{6-7}', 30),
  ('platos', 'jolasa', 'irekia', 'Txanponak platerekin', 'Diruarekin magia', 'Txanpon bat plater batetik bestera pasatzen duzu eta, bigarren platerean, bi daude! Berriz egitean, hiru!', '2 plater · 3 txanpon · orri zuri bat · zeloa · guraizeak', NULL, '{6-7,8-10}', 40),
  ('goma-saltaria', 'jolasa', 'irekia', 'Goma saltaria', 'Magia gomekin', 'Objektuak hipnotizatzen ditugu! Goma hipnotizatzen duzu eta esaten diozuna egiten du, ezinezkoa izan arren: atzamar batzuetatik besteetara jauzi egiten du.', '2 goma (bata jolaserako, bestea hesirako)', NULL, '{8-10}', 50),
  ('pulgar', 'jolasa', 'irekia', 'Gomak erpurua zeharkatzen du', 'Goma ezinezkoak · 1', 'Goma bat erpuruaren inguruan dago eta, tira egitean, erpurua zeharkatzen du! Begiratu ondo eskuei eta argazkiei.', 'goma bat', NULL, '{8-10,11}', 60),
  ('palillo', 'jolasa', 'irekia', 'Makiltxoa desagertzen da', 'Magia makiltxoekin', 'Makiltxo bat daukazu eskuan, keinu magiko bat eta... desagertu da! Berriz agertzen da, beste eskuarekin «hartzen» duzu eta berriz desagertzen da.', 'makiltxo bat · zelo apur bat', NULL, '{8-10}', 70),
  ('reloj', 'jolasa', 'irekia', 'Erlojua', 'Kartekin magia', 'Karta-sorta egutegi bat da (4 palo = 4 urtaro, 12 irudi = 12 hilabete...) eta erloju bat ere bai! Ikusle batek ordu bat pentsatzen du, zuk asmatzen duzu... eta haren karta aurrez iragarrita zeneukan.', 'karta-sorta bat · errotulatzaile bat, dorsoaren kolore berekoa · paper txiki bat gezia marrazteko', NULL, '{11}', 80),
  ('billete', 'jolasa', 'irekia', 'Billetea gomatik gomara', 'Goma ezinezkoak · 2', 'Ikusleak billete tolestu bat jartzen du goiko gomaren gainean eta, magiaz, billetea gomaz goma jaisten da behekoraino.', '2 goma · billete bat (edo billete baten tamainako paper zati bat)', NULL, '{11}', 90),
  ('uno', 'jolasa', 'irekia', 'Etorkizuna asmatu', 'Kartekin magia', 'Hiru gauza aurrez asmatuko dituzu: txanpon bat nola eroriko den, dadoek zer emango duten eta ikusleak zein karta aukeratuko duen. Amaieran, hiru paperek asmatu dute!', 'karta-sorta bat · baso bat · 3 paper txiki · arkatz bat · txanpon bat · 2 dado', NULL, '{11}', 100),
  ('sekretua-1', 'sekretua', 'sekretua', 'Sekretua 1', NULL, NULL, NULL, NULL, '{}', 900),
  ('sekretua-2', 'sekretua', 'sekretua', 'Sekretua 2', NULL, NULL, NULL, NULL, '{}', 910),
  ('sekretua-3', 'sekretua', 'sekretua', 'Sekretua 3', NULL, NULL, NULL, NULL, '{}', 920)
ON CONFLICT (slug) DO NOTHING;
