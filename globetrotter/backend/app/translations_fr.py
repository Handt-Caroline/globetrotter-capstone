# =============================================================================
# translations_fr.py  -  FRENCH CONTENT
#
# WHY THIS FILE EXISTS
# --------------------
# Cameroon is officially bilingual, French and English, and Yaounde is a
# majority-francophone city. An app about Yaounde that only speaks English
# is the wrong app. So every destination has a French version of the text
# a visitor actually reads.
#
# HOW IT WORKS
# ------------
# seed.py holds the English text. This file holds French overrides, keyed by
# the same destination id. When the frontend asks for /destinations?lang=fr,
# routers/destinations.py merges the two: French where we have it, English
# where we don't, so nothing is ever blank.
#
# WHY NOT PUT BOTH LANGUAGES IN seed.py?
# --------------------------------------
# Separating them keeps each file readable, lets a translator work on this
# file alone without touching application data, and makes adding a third
# language later a copy of this file rather than a rewrite of the seed.
# =============================================================================

FR_TEXT = {
    "dest_landmarks_01": {
        "name": "Monument de la Réunification",
        "description": "La tour en spirale du boulevard de la Réunification, érigée pour marquer la réunion des deux Cameroun en 1961.",
        "history": (
            "Si vous ne voyez qu'un seul monument à Yaoundé, que ce soit celui-ci.\n\nL'histoire commence en 1919. Après la défaite allemande, la colonie du Kamerun est partagée entre la France et la Grande-Bretagne. Pendant quarante ans, deux Cameroun coexistent. Le 1er octobre 1961, à la suite d'un plébiscite, le Southern Cameroons rejoint la République du Cameroun indépendante. En 1972, la fédération laisse place à la République unie du Cameroun.\n\nLe président Ahmadou Ahidjo lance alors un concours national et international. Trois noms en sortent : Engelbert Mveng, prêtre jésuite, historien et artiste camerounais, concepteur de la tour en spirale et des reliefs culturels ; Armand Salomon, architecte français, réalisateur du monument principal ; et Gédéon Mpando, sculpteur camerounais, auteur de la statue. Les travaux se déroulent de 1973 à 1976 environ.\n\nLe monument se lit comme un texte. La tour est faite de deux spirales qui montent et fusionnent au sommet — on les décrit souvent comme deux serpents dont les têtes se rejoignent : les deux Cameroun devenant un. À l'intérieur du cône, des piliers portent les reliefs de Mveng représentant les aires culturelles du pays. À côté se dresse la sculpture de Mpando, environ sept mètres de haut et cinquante-trois tonnes de béton : un vieil homme brandissant le flambeau national, des enfants accrochés à lui. L'ancien, c'est la génération qui a lutté pour la réunification ; les enfants, celles qui en héritent, les filles délibérément placées à égalité avec les garçons.\n\nLe monument n'est pas un objet neutre aujourd'hui. L'unité qu'il célèbre est mise à l'épreuve par la crise anglophone depuis 2016, et les Camerounais débattent du sens de cette spirale. Ce débat fait partie du lieu."
        ),
        "getting_there": "Sur le boulevard de la Réunification, au plateau Atemengue. Tout taxi allant vers la Poste Centrale ou le carrefour Warda vous dépose à quelques minutes à pied : dites simplement « monument ».",
        "what_to_expect": "Une esplanade surélevée, des rampes et escaliers, des pelouses et des fleurs. Comptez 30 à 45 minutes. Des guides informels proposent des explications : convenez du prix avant.",
        "tips": "Le matin tôt, c'est plus calme et la lumière sur la spirale est meilleure. Demandez avant de photographier quelqu'un. Prévoyez des petites coupures de 500 et 1 000 FCFA.",
    },
    "dest_landmarks_02": {
        "name": "Palais des Congrès",
        "description": "Le palais des congrès de Yaoundé : cérémonies d'État, congrès et grands concerts.",
        "history": (
            "Le Palais des Congrès est le lieu où le Cameroun officiel se met en scène. Congrès de parti, sommets, cérémonies d'État et remises de prix nationales s'y tiennent, et son grand auditorium est l'une des plus importantes salles de spectacle formelles de la ville.\n\nSon intérêt tient moins à son âge qu'à sa fonction. Dans une capitale née d'un poste allemand devenue ville administrative, ce type de bâtiment exprime physiquement l'État post-indépendance : vaste, volontairement impressionnant, conçu pour accueillir des délégations.\n\nPour le visiteur, l'intérêt est double. Architecturalement, il appartient à la vague de constructions civiques qui a redessiné les quartiers du plateau après 1960. Culturellement, c'est l'un des rares endroits où l'on peut voir un concert symphonique, un ballet national ou un grand artiste camerounais sur une vraie scène.\n\nLa programmation est irrégulière et rarement annoncée longtemps à l'avance — on apprend un spectacle une semaine avant, par une affiche, la radio ou un ami."
        ),
        "getting_there": "Sur les hauteurs vers Tsinga / Ngoa-Ekellé, 10 à 15 minutes en taxi depuis la Poste Centrale.",
        "what_to_expect": "Hors événement, on peut parcourir les abords et photographier l'extérieur. Les soirs de spectacle : contrôles de sécurité, public bien habillé, et un début plus tardif que l'heure annoncée.",
        "tips": "Les prix varient énormément : une cérémonie publique peut être gratuite, un grand concert 10 000 à 25 000 FCFA. Achetez au guichet officiel, en espèces.",
    },
    "dest_landmarks_03": {
        "name": "Boulevard du 20 Mai",
        "description": "L'avenue cérémonielle du quartier administratif, qui porte le nom de la fête nationale.",
        "history": (
            "Le boulevard du 20 Mai tire son nom du 20 mai 1972, date du référendum qui a transformé la république fédérale en République unie du Cameroun. Chaque année, l'avenue devient la scène principale du pays : le défilé de la fête nationale y passe devant la tribune, avec l'armée, les écoles, les universités et les associations.\n\nLe reste de l'année, c'est la colonne vertébrale du quartier administratif. Ministères, banques, poste centrale et grands hôtels s'y alignent, et c'est l'une des rares portions vraiment larges et praticables à pied dans une ville bâtie sur sept collines.\n\nLa parcourir d'un bout à l'autre est la façon la plus rapide de lire les couches de Yaoundé : bâtiments administratifs coloniaux, architecture d'État des années 1970, banques et opérateurs télécoms en verre. Entre eux, vendeurs ambulants, cireurs, revendeurs de crédit téléphonique et motos-taxis : l'économie réelle de la capitale, à ciel ouvert."
        ),
        "getting_there": "Central : la plupart des lignes de taxi le traversent. Demandez « boulevard du 20 Mai » ou « Poste Centrale ».",
        "what_to_expect": "De larges trottoirs, une circulation dense, du commerce partout. Autour du 20 mai, le secteur est fermé aux voitures et bondé. Avant 9 h, c'est calme.",
        "tips": "Photographiez librement les portions commerciales, jamais les bâtiments présidentiels et militaires. Emportez de l'eau : il y a peu d'ombre à midi.",
    },
    "dest_museums_01": {
        "name": "Musée National du Cameroun",
        "description": "Le musée national, installé dans l'ancien palais présidentiel : une trentaine de salles pour les dix régions.",
        "history": (
            "Le bâtiment est venu d'abord, et il a changé de mains à chaque changement de pouvoir.\n\nLe site a d'abord servi de résidence au major Hans Dominik, qui dirigeait le poste militaire de Yaoundé à l'époque du protectorat allemand. Après la Première Guerre mondiale, les Français reprennent le terrain et, en 1930, le gouverneur Théodore Marchand y fait construire sa résidence. À la fin des années 1940, le bâtiment abrite les gouverneurs français. Après l'indépendance, il devient le palais présidentiel d'Ahmadou Ahidjo.\n\nLe 17 novembre 1988, un décret présidentiel affecte l'ancien palais au Musée national. L'ensemble couvre environ 15 000 m², dont un édifice central de 5 000 m², des annexes et un jardin. Première ouverture au public en janvier 2001, lors du sommet France-Afrique ; fermeture en juillet 2009 pour rénovation, sous l'impulsion de la ministre des Arts et de la Culture Ama Tutu Muna ; réouverture officielle le 16 janvier 2015.\n\nÀ l'intérieur, une trentaine de salles vous mènent de la préhistoire à aujourd'hui : les dix régions et leurs costumes, les instruments de musique traditionnels, les objets rituels, les insignes de chefs traditionnels, les archives photographiques de l'histoire politique — et, pour les mélomanes, le saxophone de Manu Dibango.\n\nCe qui rend ce musée singulier, c'est ce dédoublement : vous traversez les collections de la nation dans la maison où la nation était gouvernée."
        ),
        "getting_there": "Au centre, près du Palais de Justice, accessible à pied depuis le boulevard du 20 Mai. Demandez « musée national ».",
        "what_to_expect": "Deux à trois heures si vous lisez les panneaux. Les visites guidées valent vraiment la peine. Les sacs peuvent être contrôlés et les règles de photographie varient selon les salles.",
        "tips": "Fermé le lundi dans la plupart des programmes, et parfois pour des cérémonies officielles : vérifiez avant de traverser la ville. Demandez la grille tarifaire officielle et gardez votre ticket.",
    },
    "dest_museums_02": {
        "name": "Musée d'Art Camerounais (Monastère des Bénédictins)",
        "description": "Une petite mais superbe collection de masques, bronzes et instruments, au monastère bénédictin du Mont Fébé.",
        "history": (
            "Trois moines bénédictins ont fondé cette communauté sur le flanc du Mont Fébé dans les années 1960, première présence bénédictine au Cameroun. À côté du monastère, ils ont bâti quelque chose d'inattendu : un musée d'art camerounais, constitué en grande partie par la collecte patiente des moines eux-mêmes.\n\nIl est petit — quelques salles — et c'est son charme. Là où le Musée national raconte un État, cette collection parle d'objets et de savoir-faire : masques et statues en bois, bronzes finement travaillés, tabourets de chefs, pipes, pièces rituelles et instruments de musique venus de tout le pays, avec une forte présence des Grassfields.\n\nLe monastère fait partie de la visite. Les moines tiennent un collège technique (menuiserie, maçonnerie) et une hôtellerie pour les retraites spirituelles. On peut assister à la messe : le chant dans une chapelle au-dessus de la ville est, pour beaucoup, le souvenir qui reste.\n\nAjustez vos attentes : les cartels sont rares et la muséographie modeste. Venez pour la qualité des objets, le calme et la vue sur Yaoundé depuis la terrasse."
        ),
        "getting_there": "Sur la route du Mont Fébé, au-dessus de la ville, après le golf. Prenez un taxi privé et négociez l'attente ou le retour : 20 à 30 minutes depuis le centre.",
        "what_to_expect": "Environ 45 minutes pour la collection. Les horaires suivent la vie monastique : le milieu de matinée ou d'après-midi est le plus sûr. Tenue correcte exigée.",
        "tips": "Combinez la visite avec la grotte mariale et le belvédère du Mont Fébé, sur la même route. Prévoyez des espèces : pas de paiement par carte.",
    },
    "dest_religious_01": {
        "name": "Basilique Marie-Reine-des-Apôtres de Mvolyé",
        "description": "L'église mère du Yaoundé catholique, sur la colline où la première mission fut fondée en 1901.",
        "history": (
            "Le 13 février 1901, des missionnaires pallottins allemands — parmi eux le père Heinrich Vieter et le frère Jean Jager — foulent pour la première fois le sol du Mfoundi. Le chef Essomba Mebe accueille Vieter et lui donne un terrain sur la colline de Mvolyé : la première mission catholique de Yaoundé y est implantée.\n\nLa mission grandit vite. Le 22 janvier 1905, Vieter devient le premier évêque du Cameroun et Mvolyé devient le siège du vicariat apostolique. Mvolyé est la mission-mère de l'archidiocèse de Yaoundé et des diocèses qui en sont issus : Doumé (1949), Mbalmayo (1961), Bafia (1965).\n\nDe 1923 à 1927, une cathédrale dédiée au Saint-Esprit y est construite, la première église étant devenue trop petite. C'est là que la dépouille de Mgr Vogt fut exposée en 1943 avant son inhumation au cimetière voisin, à côté de Mgr Vieter, et là aussi que furent célébrées les funérailles du chef supérieur Charles Atangana.\n\nEn 1990, la vieille cathédrale menace ruine. Mgr Jean Zoa, premier archevêque camerounais de Yaoundé, la fait détruire pour y bâtir un sanctuaire marial ; la première pierre est posée le 15 août 1990. La nouvelle église repose sur douze colonnes représentant les douze apôtres, mesure environ 32 mètres de haut et 75 mètres de large, et peut accueillir près de 4 000 personnes. Son architecture circulaire et ouverte intègre matériaux et savoir-faire camerounais : l'inculturation bâtie en pierre.\n\nLe 10 décembre 2006, le cardinal Jean-Louis Tauran, légat du pape Benoît XVI, la proclame basilique mineure. Benoît XVI y a prononcé les vêpres le 18 mars 2009 lors de sa visite à Yaoundé."
        ),
        "getting_there": "Sortie sud de la ville, sur la colline de Mvolyé. Taxi partagé vers Mvolyé ou Efoulan puis une petite montée ; 15 à 20 minutes en taxi privé depuis le centre.",
        "what_to_expect": "Un vaste intérieur circulaire et lumineux, et une terrasse avec l'une des plus belles vues sur Yaoundé au crépuscule. La messe du dimanche est longue, musicale et pleine.",
        "tips": "Épaules et genoux couverts. Restez pour le coucher du soleil. Photographiez l'édifice librement, les fidèles seulement avec leur accord.",
    },
    "dest_religious_02": {
        "name": "Cathédrale Notre-Dame-des-Victoires",
        "description": "La cathédrale métropolitaine du centre-ville, repère du Yaoundé catholique.",
        "history": (
            "Notre-Dame-des-Victoires est la cathédrale de l'archidiocèse de Yaoundé et l'église que les visiteurs rencontrent en premier, parce qu'elle se trouve au milieu du centre-ville plutôt que sur une colline.\n\nLe catholicisme arrive à Yaoundé avec les pallottins à Mvolyé en 1901 et se développe pendant les périodes allemande et française ; à mesure que la ville administrative grandit autour du plateau, il lui faut une cathédrale en son centre. Le résultat est une cathédrale vivante : messes en français et en ewondo, chorales qui remplissent la nef, mariages et funérailles qui débordent sur la rue.\n\nCulturellement, c'est la musique qui frappe. Le chant liturgique camerounais mêle hymnes européens, harmonies locales et percussions : une grand-messe du dimanche est l'une des expériences culturelles les plus authentiques et les moins chères de la capitale."
        ),
        "getting_there": "À distance de marche de la Poste Centrale et du boulevard du 20 Mai.",
        "what_to_expect": "Ouverte dans la journée entre les offices. Le dimanche matin, c'est plein et joyeux : arrivez tôt. Les après-midis de semaine sont presque vides et frais.",
        "tips": "Tenue correcte. Rangez le téléphone pendant la liturgie. La circulation devant est dense : attention aux motos.",
    },
    "dest_religious_03": {
        "name": "Grotte Mariale du Mont Fébé",
        "description": "Une grotte mariale creusée dans la roche du Mont Fébé, inspirée de Lourdes, avec vue sur toute la ville.",
        "history": (
            "Creusée dans la pierre sur le flanc ouest du Mont Fébé, la grotte abrite une statue de la Vierge au-dessus d'un espace de prière. Elle a été offerte à l'Église de Yaoundé par André Fouda, tout premier maire camerounais de la ville — « Ongola Ewondo » —, et elle est affiliée à la grotte de Lourdes dont elle reprend la forme.\n\nElle fait partie de la vie religieuse de Yaoundé depuis une cinquantaine d'années. Les jours de fêtes mariales, et tout au long du mois de mai, des groupes montent la colline pour y prier ; les autres jours, c'est l'un des endroits les plus calmes à portée du centre.\n\nLe lieu fait aussi ce qu'aucun intérieur d'église ne peut faire : il met la ville devant vous. Depuis la terrasse, les sept collines, les quartiers du plateau, Mvolyé et la vallée du Mfoundi se lisent d'un seul coup d'œil."
        ),
        "getting_there": "Sur la route du Mont Fébé, en montant vers le monastère et l'hôtel. Taxi privé depuis le centre, 20 à 25 minutes ; demandez au chauffeur d'attendre.",
        "what_to_expect": "Une courte marche depuis le parking jusqu'à la grotte et la terrasse. Atmosphère de recueillement ; un poste de police filtre l'accès plus haut, donc gardez une pièce d'identité.",
        "tips": "Allez-y en fin d'après-midi pour la lumière et la fraîcheur. Tenue modeste et voix basse si des gens prient.",
    },
    "dest_viewpoints_01": {
        "name": "Mont Fébé — panorama sur Yaoundé",
        "description": "La colline verdoyante au nord-ouest, à environ 1 060 m, avec la plus large vue sur les sept collines.",
        "history": (
            "On compare souvent Yaoundé à Rome parce qu'elle est bâtie sur sept collines. Le Mont Fébé est celle qui permet de le vérifier : d'en haut, les crêtes et les vallées s'alignent et la géographie qui a façonné la capitale devient évidente.\n\nLa colline culmine à environ 1 060 mètres, soit quelque 300 mètres au-dessus du plateau du centre-ville, et il y fait sensiblement plus frais et plus venteux. En ewondo, « Fébé » est couramment expliqué comme le vent — ce que confirme quiconque s'est tenu sur la crête en fin d'après-midi.\n\nC'est l'adresse prestigieuse de la ville depuis des décennies. Le Golf Club de Yaoundé y a ouvert en 1957 : le plus ancien parcours du Cameroun, dix-huit trous sur près de soixante hectares vallonnés. En 1968-69, le président Ahmadou Ahidjo fait construire l'Hôtel Mont Fébé sur le flanc, près du palais présidentiel, précisément parce qu'il aimait dominer sa capitale. Le monastère bénédictin et son musée datent de la même décennie, et la grotte mariale se trouve en contrebas.\n\nPlus bas encore, le Parcours Vita est un parc sportif public où Yaoundé vient courir et s'entraîner, surtout le week-end."
        ),
        "getting_there": "Taxi privé depuis le centre (20 à 30 min) en négociant l'attente ou le retour ; les taxis partagés se raréfient en montant.",
        "what_to_expect": "Air frais, forêt, sportifs sur le Parcours Vita, points de vue le long de la route. Un poste de police contrôle l'accès près du sommet.",
        "tips": "Gardez une pièce d'identité. Venez au coucher du soleil mais organisez votre retour à l'avance. La saison sèche, de novembre à février, offre les vues les plus nettes.",
    },
    "dest_outdoor_01": {
        "name": "Parcours Vita du Mont Fébé",
        "description": "Le parcours sportif en plein air sur les pentes boisées : course, marche et entraînements du week-end.",
        "history": (
            "Le Parcours Vita, c'est là que Yaoundé fait du sport. Aménagé sur le flanc boisé du Mont Fébé, à la fois circuit sportif et parc de loisirs, il attire coureurs, marcheurs, équipes de football à l'échauffement et groupes d'entraînement informels — surtout le samedi et le dimanche matin.\n\nCela compte plus qu'une simple piste de jogging, parce que l'espace vert public est rare dans la capitale. Yaoundé a grandi vite et de façon inégale sur un relief accidenté, et la plupart des quartiers ont peu de terrain libre. Le versant de Fébé, protégé en partie par les institutions installées plus haut, a gardé ses arbres.\n\nVenez un samedi à 7 h et vous obtenez un portrait de la ville qu'aucun musée n'offre : aérobic en musique dans une clairière, un coach de boxe qui fait travailler des adolescents dans une autre, des familles qui font la boucle, et des vendeurs d'eau, de maïs grillé et de kola à l'entrée."
        ),
        "getting_there": "En dessous du monastère, sur la route du Mont Fébé. 15 à 20 minutes en taxi depuis le centre.",
        "what_to_expect": "Sentiers non goudronnés et vallonnés, aires d'exercice en plein air. Animé tôt le matin, presque vide à midi. Quelques vendeurs à l'entrée, pas d'équipements formels.",
        "tips": "Allez-y tôt : après 9 h il fait chaud. Chaussures de sport, pas de sandales. Laissez vos objets de valeur et gardez juste de quoi acheter de l'eau.",
    },
    "dest_nature_01": {
        "name": "Jardin Zoo-Botanique de Mvog-Betsi",
        "description": "Le zoo et jardin botanique de la ville, refuge de primates d'Afrique centrale depuis 1951.",
        "history": (
            "Les noms ewondo du quartier disent ce qu'il était bien avant les grilles : Nkolka, « colline des bœufs », et Mvog Betsi, compris comme la contrée des animaux — une ferme avicole et une station d'élevage y ont fonctionné entre 1925 et 1930 environ.\n\nLe zoo proprement dit est créé en 1951 par monsieur Pfeiffer, chef de service de l'administration coloniale, pour y conserver des animaux sauvages vivants. De 1956 à 1971, il passe entre les mains de plusieurs particuliers qui l'utilisent notamment comme espace de quarantaine pour des animaux destinés à l'exportation. En 1971, il revient à l'administration camerounaise — Eaux et Forêts, puis délégation générale au Tourisme, et à partir de 1992 le ministère de l'Environnement et des Forêts.\n\nL'état du site se dégrade fortement jusqu'en 1997, année où le ministre décide sa réhabilitation et sa transformation en parc zoologique et botanique, avec l'appui du gouvernement britannique. Il relève aujourd'hui du ministère des Forêts et de la Faune (MINFOF).\n\nLa collection est dominée par les primates — mandrills, drills, babouins, cercocèbes agiles, singes de De Brazza — aux côtés de fauves, de rapaces et de reptiles, dans une végétation tropicale réellement riche. Beaucoup d'animaux proviennent de saisies liées au commerce de viande de brousse et d'animaux de compagnie : c'est le sous-texte honnête de la visite, un centre de sauvetage autant qu'un zoo, chroniquement sous-financé."
        ),
        "getting_there": "Melen / Mvog-Betsi, à côté du quartier de la Garde présidentielle. Taxi partagé vers Melen ou « carrefour GP », puis quelques minutes à pied.",
        "what_to_expect": "Une à deux heures. Allées ombragées, pelouses, aires de jeux, point de restauration. La qualité des enclos varie ; la section des primates est la plus intéressante.",
        "tips": "Le samedi et le dimanche matin, c'est la sortie familiale locale. Ne nourrissez pas les animaux. Prévoyez des espèces pour l'entrée et un pourboire pour le guide.",
    },
    "dest_nature_02": {
        "name": "Lac Municipal (Lac Central)",
        "description": "Le lac du centre-ville et sa promenade, rare étendue d'eau et d'ombre au cœur de la capitale.",
        "history": (
            "Le lac municipal occupe le fond de vallée du centre-ville, un creux humide entre les quartiers du plateau, aménagé en plan d'eau et en promenade publique à mesure que Yaoundé s'urbanisait.\n\nSon importance est plus sociale qu'historique. Dans une capitale où l'espace ouvert accessible est rare, le lac et ses abords sont devenus un lieu de rendez-vous par défaut : étudiants des établissements voisins, couples, coureurs, football sur le moindre terrain plat, et petits commerces de nourriture et de boissons sur les bords.\n\nLe lac rappelle aussi une réalité géographique : Yaoundé se situe entre les bassins du Nyong et de la Sanaga, et son centre se draine par cette cuvette. C'est aussi pourquoi les fortes pluies inondent ces quartiers — un problème municipal toujours d'actualité."
        ),
        "getting_there": "En contrebas des rues principales du centre ; accessible à pied depuis la Poste Centrale ou en taxi en disant « lac ».",
        "what_to_expect": "Un tour de lac praticable à pied, de l'ombre, de la nourriture de rue et un public entièrement local. Le plus animé en fin d'après-midi et le week-end.",
        "tips": "Préférez la journée. Gardez votre téléphone dans une poche plutôt qu'à la main dans les zones denses.",
    },
    "dest_shopping_01": {
        "name": "Marché Central de Yaoundé",
        "description": "Le grand marché couvert de la capitale : pagne, produits frais, électronique, quincaillerie.",
        "history": (
            "Toute grande ville camerounaise s'organise autour de ses marchés, et le Marché Central est le cœur commercial de Yaoundé : le point où les marchandises venues du port de Douala et des Grassfields rencontrent les acheteurs.\n\nSon rythme est ancien. Yaoundé naît en 1888 comme poste allemand commerçant l'ivoire et le caoutchouc, et sa fonction de plaque tournante de l'intérieur n'a jamais cessé : seuls les produits ont changé. Aujourd'hui, c'est le pagne au rouleau, la friperie, les pièces de téléphone, le cacao et le café, l'huile, les épices et la quincaillerie.\n\nPour un visiteur, c'est l'expérience culturelle la plus dense de la ville : les langues qui alternent entre français, anglais, ewondo, langues bamiléké et fulfulde en quelques mètres ; toute la géographie nationale représentée par les commerçants ; et des prix fixés par la négociation, jamais par une étiquette.\n\nC'est la section des tissus dont on se souvient. Acheter trois ou six mètres de pagne et le faire coudre par un tailleur du quartier en deux jours reste le souvenir le plus camerounais qui soit."
        ),
        "getting_there": "Au centre, à quelques minutes de la Poste Centrale. Entrez à pied : l'accès en voiture est saturé.",
        "what_to_expect": "Foule dense, allées étroites, bruit constant, vente insistante mais bon enfant. Espèces uniquement. La négociation est attendue.",
        "tips": "Venez le matin : il fait plus frais et l'offre est meilleure. Petites coupures, sac devant vous, pas de bijoux, et fixez un prix avant que quelqu'un ne porte quoi que ce soit pour vous.",
    },
    "dest_shopping_02": {
        "name": "Marché Mokolo",
        "description": "Le grand marché populaire du nord-ouest : les prix les plus bas, la foule la plus dense.",
        "history": (
            "Mokolo, c'est là que Yaoundé fait vraiment ses courses. Plus vaste, plus rude et moins cher que le marché central, il a grandi avec les quartiers populaires de Briqueterie, Messa et Madagascar, à mesure que la ville débordait du plateau colonial dans la seconde moitié du XXe siècle.\n\nC'est une ville dans la ville : sections pour les produits frais, la viande et le poisson, les produits secs, la friperie en balles, les chaussures, les ustensiles, l'outillage, et des étals de médecine traditionnelle vendant écorces, racines et poudres. Des grossistes y approvisionnent les petits marchés de quartier de toute la capitale, d'où des prix plus bas et des volumes plus grands.\n\nC'est aussi l'un des espaces les plus visiblement multirégionaux de Yaoundé, avec de fortes présences commerçantes bamiléké et septentrionales aux côtés des vendeurs beti : une bonne façon de comprendre comment les migrations internes ont bâti la population de la capitale.\n\nSoyez honnête sur votre tolérance à la foule : Mokolo est intense, boueux après la pluie, avec des passages étroits."
        ),
        "getting_there": "Taxi partagé jusqu'à « Mokolo », au nord-ouest du centre après Briqueterie.",
        "what_to_expect": "Très dense, très bruyant, boueux en saison des pluies. Espèces uniquement, négociation ferme, aucune concession au tourisme — c'est précisément l'intérêt.",
        "tips": "Allez-y avec quelqu'un du coin si possible, et le matin. N'emportez rien que vous ne voudriez perdre et gardez les téléphones hors de vue : le vrai risque est le vol à la tire, pas le danger.",
    },
    "dest_streetfood_01": {
        "name": "Cuisine de rue — Quartier Briqueterie",
        "description": "Le quartier des grillades : brochettes de soya, poisson braisé et cuisine du Nord à la tombée de la nuit.",
        "history": (
            "Briqueterie doit son nom à la briqueterie qui fonctionnait dans cette cuvette au nord du centre à l'époque coloniale. C'est devenu l'un des premiers quartiers populaires densément peuplés de Yaoundé, et il a attiré une large communauté venue des régions septentrionales, ce qui lui donne un caractère musulman, fulfulde et haoussaphone distinct de la ville beti alentour.\n\nC'est cette histoire qui explique qu'on y mange si bien. Les traditions de grillade du Nord — le soya, fines brochettes de bœuf frottées d'un mélange d'arachide et d'épices, cuites au charbon — se sont enracinées ici avant de se répandre dans toute la capitale, jusqu'à faire du soya le repas du soir standard à Yaoundé. Ajoutez poisson braisé, plantain, beignets, brochettes et thé à la menthe.\n\nLa scène démarre au crépuscule, quand les braseros sortent le long des rues et restent allumés tard. C'est bruyant, enfumé, bon marché et excellent.\n\nDeux plats camerounais à chercher au-delà du grill : le ndolé, feuilles amères cuisinées aux arachides avec du poisson ou du bœuf, largement considéré comme le plat national, et le poulet DG — « directeur général » — poulet sauté au plantain et aux légumes."
        ),
        "getting_there": "Au nord du centre près de Mokolo ; taxi jusqu'à « Briqueterie ». Plus simple en taxi le soir qu'à pied.",
        "what_to_expect": "Grillades de rue, chaises en plastique, pas de menu, prix à la brochette ou au poisson. Animé à partir de 19 h. Espèces, petites coupures.",
        "tips": "Mangez là où la file est la plus longue : la rotation garantit la fraîcheur. Regardez votre plat sortir du grill. Évitez l'eau du robinet et les glaçons. Tenue modeste appréciée dans ce quartier.",
    },
    "dest_restaurant_01": {
        "name": "Cuisine camerounaise — Bastos & Centre",
        "description": "Les restaurants assis : ndolé, poulet DG, eru, poisson braisé, dans des salles confortables.",
        "history": (
            "Bastos est le quartier diplomatique — ambassades, résidences, organisations internationales — et cela a façonné sa façon de manger. Les restaurants y servent la cuisine camerounaise dans une forme pensée pour les longs déjeuners et les dîners d'affaires : service à table, cartes imprimées, boissons fraîches, et un mélange de plats nationaux, libanais, français et panafricains.\n\nLes plats, eux, viennent de tout le pays. Le ndolé, ragoût de feuilles amères aux arachides avec poisson ou bœuf, tenu pour le plat national, vient du Littoral. L'eru, plat de feuilles de forêt à l'huile de palme, vient du Sud-Ouest et est un pilier du Cameroun anglophone. Le poulet DG et le capitaine ou tilapia braisé se trouvent partout. Koki, mbongo tchobi, kondrè et achu portent chacun la signature d'une région.\n\nUn vrai repas camerounais est une affaire longue — féculent, sauce, protéine et accompagnements — et l'intérêt du restaurant assis est justement de prendre le temps.\n\nLes prix à Bastos sont plus élevés qu'ailleurs à cause de la clientèle. Les mêmes plats coûtent trois fois moins cher dans un « tourne-dos » de quartier."
        ),
        "getting_there": "Bastos, au nord du centre, en montant depuis le boulevard du 20 Mai ; 10 à 15 minutes en taxi.",
        "what_to_expect": "Service à table, cartes acceptées dans les grands établissements mais espèces plus sûres, et un rythme tranquille. Le déjeuner est le repas principal pour beaucoup de Camerounais.",
        "tips": "Demandez le plat du jour : plus frais et moins cher. Goûtez le ndolé au moins une fois. Pour la même cuisine aux prix locaux, demandez où se trouve le tourne-dos le plus proche.",
    },
    "dest_cafe_01": {
        "name": "Cafés de Bastos",
        "description": "La scène café du quartier : arabica camerounais, wifi qui marche et travailleurs à distance.",
        "history": (
            "Le Cameroun cultive le café commercialement depuis plus d'un siècle — arabica dans les hautes terres de l'Ouest autour de Bamenda, Dschang et Foumbot, robusta dans le Littoral et l'Ouest — et pendant l'essentiel de cette période, les bons grains quittaient le pays verts et non torréfiés.\n\nCela a changé. Une génération de torréfacteurs et de cafetiers camerounais s'est mise à vendre l'arabica national sur place, et Bastos, avec sa population diplomatique et humanitaire, était le marché. Résultat : une petite mais réelle culture du café dans le quartier — espresso correctement préparé, grains torréfiés au pays, wifi fiable et climatisation.\n\nCes cafés sont devenus le bureau informel de la capitale : indépendants, étudiants en mémoire, consultants en rendez-vous, et un flux constant de la diaspora de retour pour quelques semaines."
        ),
        "getting_there": "Bastos, au nord du centre ; 10 à 15 minutes en taxi depuis le centre-ville.",
        "what_to_expect": "Climatisation, wifi, prises, viennoiseries, et des prix nettement au-dessus de la rue. Calme en milieu de matinée, plein à midi.",
        "tips": "Demandez si les grains sont de l'arabica camerounais et où ils ont été torréfiés. Rapportez un paquet : meilleur souvenir qu'une sculpture.",
    },
    "dest_nightlife_01": {
        "name": "Rue de la Joie, Elig-Essono",
        "description": "La rue la plus festive de Yaoundé : bars en plein air, grillades, makossa et bikutsi jusque tard.",
        "history": (
            "Le nom dit tout. La rue nocturne d'Elig-Essono est l'adresse de sortie la plus connue de Yaoundé : une enfilade de bars en plein air, de terrasses et de grillades où le volume monte après 21 h et ne redescend qu'au petit matin.\n\nLa bande-son mérite d'être connue. Le bikutsi est le rythme beti de cette région — rapide, percussif, à l'origine une musique de femmes des environs de Yaoundé, électrifiée entre les années 1960 et 1980 et portée dans le monde par des artistes comme Les Têtes Brûlées. Le makossa vient de Douala et du Littoral et est devenu l'exportation mondiale du Cameroun, surtout à travers « Soul Makossa » de Manu Dibango. Les deux passent encore chaque soir, mêlés au coupé-décalé, à l'afrobeats et au hip-hop camerounais.\n\nLa formule est simple et bon marché : chaises en plastique sur le trottoir, grandes bouteilles de bière camerounaise partagées à table, soya et poisson braisé du grill voisin, et conversation au volume maximum. Personne ne mange avant de sortir : la nourriture fait partie de la soirée."
        ),
        "getting_there": "Elig-Essono, juste au nord-est du centre. Dites « Rue de la Joie » : tous les chauffeurs connaissent.",
        "what_to_expect": "Bars en plein air, grillades, musique très forte, foule dès 21 h et pic après minuit, surtout du jeudi au samedi. Espèces uniquement.",
        "tips": "Fixez le prix du taxi avant de monter et organisez votre retour plutôt que de rentrer à pied. Commandez des bouteilles décapsulées devant vous. Téléphone dans la poche avant.",
    },
    "dest_arts_01": {
        "name": "Institut Français du Cameroun — Yaoundé",
        "description": "La programmation culturelle la plus fiable de la ville : concerts, théâtre, cinéma, expositions, médiathèque.",
        "history": (
            "L'Institut Français est le réseau culturel de l'État français à l'étranger, et son antenne de Yaoundé est depuis longtemps l'une des scènes les plus régulières du Cameroun. Son intérêt pour un visiteur tient précisément à sa programmation annoncée à l'avance : dans une ville où la plupart des événements se savent de bouche à oreille une semaine avant, ici on peut consulter le programme.\n\nLa programmation n'est pas principalement française. Musiciens, chorégraphes, compagnies de théâtre, humoristes, photographes et cinéastes camerounais y passent régulièrement, et l'institut a servi de tremplin à beaucoup de carrières locales. Projections, lancements de livres, débats et festivals complètent le calendrier.\n\nIl y a aussi une médiathèque ouverte au public, des cours de français et une cour-café qui sert de point de rendez-vous au milieu artistique de la ville."
        ),
        "getting_there": "Au centre ; accessible à pied depuis le centre-ville ou par un court trajet en taxi partagé.",
        "what_to_expect": "Contrôle à l'entrée, programme publié, public mêlant Camerounais et expatriés, et des horaires mieux respectés qu'ailleurs.",
        "tips": "Consultez le programme avant d'organiser votre soirée. Expositions et médiathèque souvent gratuites ; concerts et théâtre peu chers.",
    },
    "dest_library_01": {
        "name": "Université de Yaoundé I & Bibliothèque Nationale",
        "description": "Le campus qui a façonné la vie intellectuelle du pays, et la bibliothèque nationale et ses archives.",
        "history": (
            "L'Université de Yaoundé ouvre en 1962, deux ans après l'indépendance, et devient presque immédiatement le principal centre de recherche et d'enseignement du pays. Restructurée en 1993 en Yaoundé I et Yaoundé II, son campus de Ngoa-Ekellé est depuis le moteur intellectuel de la capitale — et, comme tout campus, une arène politique. Des générations d'écrivains, de juristes, de médecins, de fonctionnaires et de figures d'opposition camerounais y sont passées.\n\nLa Bibliothèque Nationale conserve le dépôt légal et les collections d'archives du pays : documents administratifs de l'époque coloniale, publications camerounaises, journaux et ouvrages de référence sur l'histoire du territoire, du protectorat allemand aux mandats français et britannique jusqu'à la république.\n\nNi l'un ni l'autre n'est un site touristique classique, et c'est justement pourquoi ils valent une heure. Le campus donne la texture quotidienne du Yaoundé lettré ; la bibliothèque est le seul endroit de la ville où l'on peut tenir en main la trace écrite de l'histoire que les monuments se contentent de résumer."
        ),
        "getting_there": "Ngoa-Ekellé, à l'ouest du centre, sous le Mont Fébé. Taxi partagé vers « université » ou « Ngoa-Ekellé ».",
        "what_to_expect": "Un campus animé et une salle de lecture silencieuse. Pièce d'identité nécessaire pour la bibliothèque ; certaines collections demandent un formulaire et de l'attente.",
        "tips": "En semaine et le matin uniquement. Les photocopies sont limitées : prenez des notes. Les étudiants vous orienteront volontiers si vous demandez poliment.",
    },
    "dest_sports_01": {
        "name": "Stade Ahmadou Ahidjo",
        "description": "Le stade national historique de Mfandena — les Lions Indomptables et un public à pleine voix.",
        "history": (
            "Baptisé du nom du premier président du Cameroun, le stade Ahmadou Ahidjo de Mfandena a été pendant des décennies la maison de l'équipe nationale et le centre émotionnel du sport camerounais.\n\nLe football n'est pas ici un passe-temps, c'est une identité nationale. Le parcours des Lions Indomptables jusqu'en quarts de finale de la Coupe du monde 1990 en Italie — avec la victoire d'ouverture contre l'Argentine, championne en titre, et la danse au poteau de corner de Roger Milla devenue l'une des images du tournoi — reste le plus grand souvenir sportif du pays, et il a changé le regard porté sur le football africain. Le Cameroun a remporté cinq fois la Coupe d'Afrique des Nations.\n\nLe stade a été largement rénové avant la CAN 2021, organisée par le Cameroun en janvier et février 2022, où il a accueilli des matches aux côtés du nouveau stade d'Olembé.\n\nSi un match de championnat ou un match des Lions tombe pendant votre séjour, allez-y : tambours, sifflets, vuvuzelas et commentaires ininterrompus font partie des expériences les plus drôles et les plus bruyantes de la capitale."
        ),
        "getting_there": "Mfandena, au nord-est du centre, près d'Omnisport. Taxi partagé jusqu'à « Omnisport » ; les jours de match, partez tôt ou finissez à pied.",
        "what_to_expect": "Les jours de match : files d'attente, fouilles, et un public très bruyant et bon enfant. Hors match, le complexe sert à l'entraînement et à la course.",
        "tips": "Achetez aux guichets officiels, pas aux revendeurs. N'emportez rien de précieux ni de verre, et sortez avec la foule. Espèces uniquement.",
    },
    "dest_hidden_01": {
        "name": "Vallée de la Mefou — chutes & forêt",
        "description": "Rapides, forêt et pays des primates dans la vallée de la Mefou : la vraie échappée hors de la capitale.",
        "history": (
            "La Mefou est un affluent du Nyong, et sa vallée au sud-est de Yaoundé conserve la forêt et l'eau que la ville a largement perdues. Des rapides et de petites chutes coupent la rivière là où elle traverse la roche, et la forêt équatoriale alentour abrite encore la faune qui a fait la réputation de la région.\n\nC'est aussi le pays des primates. La zone de la Mefou est connue au niveau national pour un sanctuaire accueillant gorilles, chimpanzés, drills et mandrills saisis dans le commerce de viande de brousse et d'animaux de compagnie — la même crise qui remplit les enclos de Mvog-Betsi. Le Cameroun se trouve au cœur du bassin du Congo, deuxième forêt tropicale du monde, et la pression exercée sur elle par l'exploitation forestière, l'agriculture et la chasse est l'histoire environnementale majeure du pays.\n\nPour un visiteur, la vallée est une demi-journée : marches en forêt, points de vue sur la rivière, oiseaux, et des villages dont le rythme n'a rien à voir avec celui de la capitale."
        ),
        "getting_there": "Au sud-est de Yaoundé en direction de Mfou ; environ une heure de route selon l'état des pistes. Louez une voiture avec chauffeur à la journée.",
        "what_to_expect": "Pistes non goudronnées, sentiers forestiers, aucune infrastructure aux chutes. Si vous visitez un sanctuaire, horaires fixes et droit d'entrée.",
        "tips": "La saison sèche est bien plus praticable. Chaussures fermées, manches longues, répulsif, et espèces pour l'entrée et le chauffeur. Fixez le tarif de la journée avant de partir.",
    },
    "dest_traditions_01": {
        "name": "Artisanat & sculpture sur bois — Mvog-Betsi",
        "description": "Ateliers d'artisans : masques, tabourets, bronzes, tissus et perles, vendus en direct.",
        "history": (
            "On appelle parfois le Cameroun « l'Afrique en miniature » parce que tant de zones culturelles et écologiques du continent y sont réunies, et son artisanat le montre. Les royaumes des Grassfields de l'Ouest — Bamoun, Bamiléké, Bandjoun, Foumban — ont produit les trônes sculptés, les tabourets perlés, les masques éléphants et les bronzes à la cire perdue qui définissent l'art camerounais dans les musées étrangers. Les peuples forestiers du Sud et de l'Est sculptent autrement ; les traditions du Nord travaillent le cuir, la calebasse et la paille.\n\nYaoundé, capitale, attire tout cela. Les ateliers et étals autour de Mvog-Betsi et près du zoo vendent des pièces de toutes les régions, et certains sculpteurs travaillent sur place : c'est la raison de venir ici plutôt que dans une boutique d'hôtel. Vous voyez l'outil entrer dans le bois, vous demandez à quoi sert le masque, et vous achetez à celui qui l'a fait.\n\nDeux choses à savoir avant de dépenser. D'abord, il y a une vraie différence entre un objet cérémoniel fait pour être utilisé et une copie décorative faite pour la vente ; un bon vendeur vous dira honnêtement ce que vous tenez. Ensuite, les antiquités authentiques et tout produit en ivoire ou issu de la faune sont soumis à des restrictions d'exportation — l'ivoire étant purement interdit."
        ),
        "getting_there": "Mvog-Betsi, près du zoo ; taxi partagé vers Melen ou Mvog-Betsi.",
        "what_to_expect": "Ateliers ouverts, sculpteurs au travail, négociation ferme. Espèces uniquement, et des prix de départ très au-dessus de la valeur réelle.",
        "tips": "Comptez payer un tiers à la moitié du premier prix après négociation. Demandez de quelle région vient une pièce et ce qu'elle représente. Évitez tout ivoire : il ne peut pas être exporté légalement.",
    },
    "dest_wellness_01": {
        "name": "Spas & piscines d'hôtel — Bastos / Mont Fébé",
        "description": "Piscines, massages et calme dans les grands hôtels : l'endroit où la ville débranche une après-midi.",
        "history": (
            "Le bien-être hôtelier de Yaoundé existe à cause de la diplomatie. La capitale accueille ambassades, délégations de l'Union africaine et des Nations unies et un flux constant de conférences, et les hôtels construits pour ce public — le Hilton en ville, le Mont Fébé sur la colline au-dessus du golf, ouvert en 1968-69 sous Ahmadou Ahidjo — sont venus avec piscines, salles de sport et cabines de soins.\n\nCes installations sont généralement ouvertes aux non-résidents à la journée, ce qui en fait l'une des rares options vraiment reposantes dans une ville où l'espace de loisir public est limité. Le cadre du Mont Fébé est l'atout principal : des piscines à flanc de colline vers 950 mètres, la capitale étalée en contrebas, et une brise que le plateau n'a jamais.\n\nIl faut cependant garder les yeux ouverts sur le contraste : une entrée à la journée coûte plus que ce que beaucoup de Yaoundéens gagnent en un jour."
        ),
        "getting_there": "Bastos et la route du Mont Fébé, 10 à 25 minutes en taxi depuis le centre.",
        "what_to_expect": "Entrées à la journée pour la piscine, soins payants, serviettes fournies, et une clientèle mêlant diplomates et cadres locaux. Calme en semaine, animé le dimanche.",
        "tips": "Appelez avant pour confirmer le tarif et l'ouverture de la piscine. Les grands hôtels acceptent la carte, mais gardez des espèces.",
    },
    "dest_coworking_01": {
        "name": "Espaces de coworking — Bastos & Centre",
        "description": "Bureaux, groupe électrogène et fibre stable pour le travail à distance, et les meetups de la tech yaoundéenne.",
        "history": (
            "L'écosystème tech camerounais s'est construit autour d'un problème précis : les coupures de courant et une bande passante irrégulière rendent le télétravail à domicile imprévisible. Les espaces de coworking ont résolu cela en mutualisant un groupe électrogène, un onduleur et une vraie connexion, et sont devenus par là même les points de rencontre de la communauté startup.\n\nDouala et Buea ont bâti les premières réputations — le cluster « Silicon Mountain » autour de l'université de Buea est le plus connu — mais Yaoundé, avec ses ministères, ses universités et ses bailleurs, a développé son propre écosystème de développeurs, de projets civic-tech, de startups fintech et d'indépendants travaillant pour des clients à l'étranger.\n\nCe qu'on achète avec une entrée à la journée, ce n'est pas seulement un bureau : meetups du soir, hackathons et démos y ont lieu. Le mobile money est quasi universel au Cameroun — MTN MoMo et Orange Money — et beaucoup de ce qui se construit localement s'y branche plutôt que sur la carte bancaire."
        ),
        "getting_there": "Surtout Bastos et les quartiers centraux ; 10 à 15 minutes en taxi depuis le centre-ville.",
        "what_to_expect": "Formules à la journée ou au mois, fibre avec secours électrique, salles de réunion, café, et un calendrier d'événements le soir.",
        "tips": "Demandez s'il y a un groupe électrogène avant de payer : c'est ce qui compte vraiment. Prenez une puce locale avec data en secours ; MTN et Orange en vendent avec une pièce d'identité.",
    },
    "dest_festivals_01": {
        "name": "Fêtes & concerts — 20 Mai et Omnisport",
        "description": "Là où la capitale célèbre : fête nationale du 20 mai, fête de la jeunesse du 11 février, concerts et rues en fête.",
        "history": (
            "Le calendrier public camerounais offre à la capitale deux grands rendez-vous. La fête nationale du 20 mai marque le référendum de 1972 qui a créé la République unie, et remplit le boulevard du 20 Mai d'un défilé des forces armées, des écoles, des universités, des corps professionnels et des associations. La fête de la jeunesse du 11 février en est l'équivalent pour les élèves, et pour beaucoup de Camerounais c'est la plus affectueuse des deux : toutes les écoles du pays défilent.\n\nAutour des cérémonies officielles, la ville fait sa propre fête. Les rues se ferment, les sonos s'installent, les grillades sortent, et les quartiers improvisent des concerts qui durent tard. Le complexe Omnisport de Mfandena accueille les plus grands spectacles payants, le Palais des Congrès les plus officiels.\n\nLa musique camerounaise vaut qu'on organise son séjour autour. Le bikutsi, né dans cette région, et le makossa venu de la côte sont les deux rythmes nationaux, rejoints par l'afrobeats et une forte scène hip-hop et « mbolé ». Le mbolé en particulier est un genre de rue né à Yaoundé, dansé avec énergie et porté par des jeunes des quartiers populaires : ce qu'il y a de plus actuel à entendre en ville."
        ),
        "getting_there": "Boulevard du 20 Mai pour les défilés ; Omnisport à Mfandena pour les grands concerts. Les deux sont fermés aux voitures les jours d'affluence.",
        "what_to_expect": "Foules très denses, sécurité renforcée, et une ville de très bonne humeur. Les défilés commencent en milieu de matinée ; les concerts commencent tard et finissent plus tard.",
        "tips": "Arrivez des heures à l'avance pour une bonne place. Eau, petites coupures, rien de précieux. Négociez les taxis à l'avance : les prix montent fortement les soirs d'événement.",
    },
    "dest_family_01": {
        "name": "Sorties en famille — parcs & loisirs",
        "description": "Le circuit avec les enfants : le zoo, la promenade du lac, les pentes de Fébé et les aires de loisirs du week-end.",
        "history": (
            "Les loisirs familiaux à Yaoundé s'organisent largement d'eux-mêmes, car les attractions dédiées aux enfants sont rares. Ce que la ville possède, ce sont quelques espaces verts et ouverts que les familles ont adoptés, et une forte culture de la sortie du week-end après la messe.\n\nLe jardin zoo-botanique de Mvog-Betsi est le point d'ancrage : pelouses ombragées, aires de jeux et animaux au même endroit. Le lac municipal offre une promenade centrale facile avec de quoi manger. Les pentes du Mont Fébé donnent de l'air frais et de la place pour courir. Autour, des aires de loisirs informelles installent châteaux gonflables, terrains de football et grillades le week-end.\n\nL'avantage pratique de cette organisation, c'est le coût : un dimanche complet en famille — transport, entrée, nourriture, boissons — tient en quelques milliers de francs. L'inconvénient, c'est que les équipements sont sommaires et que rien n'est garanti."
        ),
        "getting_there": "Les trois points d'ancrage sont accessibles en taxi partagé : « Melen/Mvog-Betsi » pour le zoo, « lac » pour le lac, « Fébé » pour la colline.",
        "what_to_expect": "Dimanches après-midi animés, aires de jeux informelles, vendeurs de nourriture et de boissons, peu d'ombre à midi et des sanitaires sommaires.",
        "tips": "Sortez le matin pour éviter la chaleur. Eau, crème solaire, lingettes et petites coupures. La pluie arrive vite en saison humide : prenez un imperméable léger.",
    },
    "dest_budget_01": {
        "name": "Yaoundé gratuit — la ville sans dépenser",
        "description": "La ville gratuite : monuments, points de vue, églises, marchés et vie de rue, pour le seul prix du temps.",
        "history": (
            "On peut passer une semaine entière et vraiment bonne à Yaoundé pour presque rien, parce que l'essentiel de ce qui rend la ville intéressante est public.\n\nLe Monument de la Réunification est gratuit. Le boulevard du 20 Mai et le quartier administratif se parcourent librement. La basilique de Mvolyé, la cathédrale du centre et la grotte mariale du Mont Fébé ne demandent que du respect et une offrande modeste. La promenade du lac, les sentiers du Parcours Vita et les points de vue de Fébé ne coûtent que le taxi. Le marché central et Mokolo se visitent gratuitement, et la meilleure cuisine de rue commence à 100 FCFA la brochette.\n\nCe qui coûte de l'argent à Yaoundé, c'est le déplacement et le confort : taxis, piscines d'hôtel, boissons importées. Apprenez le système du taxi partagé et l'équation change complètement : un « ramassage » sur un grand axe coûte quelques centaines de francs, et les motos-taxis comblent le reste. Les tarifs sont fixés par trajet et annoncés d'un signe de la main : faites-vous expliquer les gestes une fois et vous les utiliserez toute la semaine.\n\nDeux notes pratiques. Les espèces règnent, et la monnaie manque en permanence : gardez des petites coupures. Et le mobile money, MTN MoMo et Orange Money, fonctionne presque partout, souvent mieux qu'une carte bancaire."
        ),
        "getting_there": "Partout. Taxis partagés et motos-taxis couvrent toute la ville pour peu d'argent.",
        "what_to_expect": "Une ville qui se découvre à pied le matin et en taxi quand il fait chaud. Presque tous les grands sites sont gratuits ; les musées sont la principale exception payante.",
        "tips": "Le taxi partagé (« ramassage ») coûte cinq fois moins qu'un taxi privé : hélez-le, annoncez votre destination par la vitre, montez s'il klaxonne. Gardez des billets de 500 et 1 000 FCFA. Fixez tout tarif privé avant de fermer la portière.",
    },
}
