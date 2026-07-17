// 스타일 노드 21종 — 온보딩 ③ 취향 픽의 선택지 데이터.
// 출처: PostgreSQL style_nodes + brand_nodes (2026-07-14 스냅샷, 노드↔브랜드 실매핑).
// repBrand* = 온보딩 그리드에 노출하는 "고객이 알법한" 대표 브랜드 (2026-07-14 확정,
// 국내 브랜드 우선 보강 — 여성 10/21, 남성 7/19). repBrandMen: null = 남성 그리드 제외
// (Q·R — men 풀에 앵커 브랜드 없음). 유저는 브랜드를 고르고 노드는 백단 매핑.
// brandCount = primary 노드 기준, women/men = gender_scope 교집합(unisex 포함).
// sampleBrands* = style_node_confidence 상위 6개.
// 실서비스는 GET /v1/brand-nodes 로 대체 예정 (API 명세서 v1.1).

export type StyleNode = (typeof STYLE_NODES)[number];

// repBrand* → public.brand_nodes.id (2026-07-15 스냅샷, dev GET /v1/brands/search
// 정확 일치 36/36 해석 — node_id 교차검증 완료). 온보딩 그리드 픽을
// POST /v1/onboarding 의 selected_brand_ids 로 보내기 위한 매핑.
// 검색 추가 픽은 검색 API 응답이 id 를 직접 주므로 이 맵을 안 탄다.
export const REP_BRAND_IDS: Record<string, number> = {
  'Matin Kim': 5344,
  'A.P.C.': 234,
  'LOW CLASSIC': 136,
  'Mardi Mercredi': 4820,
  'Thom Browne': 200,
  'Carhartt WIP': 445,
  NEEDLES: 1191,
  WOOYOUNGMI: 1786,
  thisisneverthat: 2411,
  Supreme: 1591,
  'ADER error': 1673,
  'Off-White': 2083,
  'HYEIN SEO': 500,
  MM6: 43,
  'Gentle Monster': 1993,
  'Vivienne Westwood': 1769,
  KIJUN: 845,
  SKIMS: 587,
  "Arc'teryx": 691,
  Moncler: 1181,
  MARGESHERWOOD: 1789,
  'Post Archive Faction': 3922,
  'Maison Kitsuné': 1171,
  Lemaire: 664,
  nanamica: 589,
  'Polo Ralph Lauren': 67,
  EASTLOGUE: 2585,
  'Engineered Garments': 1726,
  'Fear of God': 609,
  'Rick Owens': 1997,
  'Juun.J': 1436,
  sacai: 1167,
  Gucci: 490,
  Salomon: 787,
  'Stone Island': 1758,
  'ANDERSSON BELL': 585,
};

export const STYLE_NODES = [
  {"id": 1, "code": "A", "nameKo": "컨템퍼러리 캐주얼", "nameEn": "Contemporary Casual", "brandCount": 394, "womenBrandCount": 187, "menBrandCount": 127, "repBrandWomen": "Matin Kim", "repBrandMen": "Post Archive Faction", "sampleBrandsWomen": ["ANYTIME LOREAK (애니타임로릭)", "BONNIE CLYDE", "COA NYC", "Dunst", "Grlfrnd", "HommeGirls"], "sampleBrandsMen": ["ANYTIME LOREAK (애니타임로릭)", "BONNIE CLYDE", "CARRER", "Dunst", "Glass Cypress", "Howlin’"]},
  {"id": 2, "code": "B", "nameKo": "프렌치 이펄리스", "nameEn": "French Effortless", "brandCount": 87, "womenBrandCount": 32, "menBrandCount": 9, "repBrandWomen": "A.P.C.", "repBrandMen": "Maison Kitsuné", "sampleBrandsWomen": ["OSPERA", "Isabel Marant Etoile", "IRO Paris", "REQINS", "Maison Kitsuné", "Loulou de Saison"], "sampleBrandsMen": ["Officine Générale", "OSPERA", "Maison Kitsuné", "AMI Paris", "A.P.C.", "Becay"]},
  {"id": 3, "code": "C", "nameKo": "스칸디 미니멀", "nameEn": "Scandi Minimal", "brandCount": 112, "womenBrandCount": 71, "menBrandCount": 36, "repBrandWomen": "LOW CLASSIC", "repBrandMen": "Lemaire", "sampleBrandsWomen": ["COMME SE-A", "determ;", "Gauchere", "müdule", "Nothing Written", "REMAIN Birger Christensen"], "sampleBrandsMen": ["Gauchere", "müdule", "SONIA CARRASCO", "System", "Norse Projects", "JEANERICA"]},
  {"id": 4, "code": "D", "nameKo": "콰이엇 럭셔리", "nameEn": "Quiet Luxury", "brandCount": 360, "womenBrandCount": 135, "menBrandCount": 57, "repBrandWomen": "Mardi Mercredi", "repBrandMen": "nanamica", "sampleBrandsWomen": ["Atlein", "Citizens of Humanity", "ELLISS", "Fane", "HÉROS", "House of Dagmar"], "sampleBrandsMen": ["ALTU", "KARA", "Kota Gushiken", "PONDER.ER", "Thistles", "The Row"]},
  {"id": 5, "code": "E", "nameKo": "모던 프렙", "nameEn": "Modern Prep", "brandCount": 34, "womenBrandCount": 4, "menBrandCount": 10, "repBrandWomen": "Thom Browne", "repBrandMen": "Polo Ralph Lauren", "sampleBrandsWomen": ["AURALEE", "Sporty & Rich", "Thom Browne", "Subdued"], "sampleBrandsMen": ["Ahluwalia &PaulSmith", "Le PÈRE", "AURALEE", "Fred Perry", "Palmes", "Manors Golf"]},
  {"id": 6, "code": "F", "nameKo": "헤리티지 아메리카나", "nameEn": "Heritage Americana", "brandCount": 178, "womenBrandCount": 25, "menBrandCount": 30, "repBrandWomen": "Carhartt WIP", "repBrandMen": "EASTLOGUE", "sampleBrandsWomen": ["PHIPPS", "Dr. Martens", "AGOLDE", "Barbour", "Bode", "Carhartt WIP"], "sampleBrandsMen": ["Deadwood", "PHIPPS", "Uniform Bridge", "Greg Lauren", "Nudie Jeans", "Dr. Martens"]},
  {"id": 7, "code": "G", "nameKo": "재패니즈 워크웨어", "nameEn": "Japanese Workwear", "brandCount": 103, "womenBrandCount": 11, "menBrandCount": 39, "repBrandWomen": "NEEDLES", "repBrandMen": "Engineered Garments", "sampleBrandsWomen": ["CCU LEATHER", "NEEDLES", "visvim", "Casey Casey", "Issuethings", "Ernie Palo"], "sampleBrandsMen": ["CCU LEATHER", "Engineered Garments", "NEEDLES", "N.Hoolywood", "visvim", "International Gallery BEAMS"]},
  {"id": 8, "code": "H", "nameKo": "사토리얼 테일러링", "nameEn": "Sartorial Tailoring", "brandCount": 50, "womenBrandCount": 9, "menBrandCount": 29, "repBrandWomen": "WOOYOUNGMI", "repBrandMen": "WOOYOUNGMI", "sampleBrandsWomen": ["ZEGNA", "TOM FORD", "Ernest W. Baker", "WOOYOUNGMI", "AARON ESH", "MAU SOLEUM"], "sampleBrandsMen": ["Bethany Williams", "Factor's", "ZEGNA", "Brioni", "TOM FORD", "Eidos"]},
  {"id": 9, "code": "I", "nameKo": "NY 뉴프렙 스트릿", "nameEn": "NY New Prep Street", "brandCount": 179, "womenBrandCount": 32, "menBrandCount": 51, "repBrandWomen": "thisisneverthat", "repBrandMen": "thisisneverthat", "sampleBrandsWomen": ["언더마이카", "About:blank", "Daniëlle Cathari", "DEVEAUX NEW YORK", "PERVERZE", "rag & bone"], "sampleBrandsMen": ["언더마이카", "About:blank", "colbo", "rag & bone", "Saintwoods", "Alexander Wang"]},
  {"id": 10, "code": "J", "nameKo": "스케이트 스트릿", "nameEn": "Skate Street", "brandCount": 125, "womenBrandCount": 29, "menBrandCount": 36, "repBrandWomen": "Supreme", "repBrandMen": "Supreme", "sampleBrandsWomen": ["BAPE", "Nike", "Vans", "슈프림", "Brain Dead", "Nike Jordan"], "sampleBrandsMen": ["Silas", "BAPE", "AAPE by A Bathing Ape", "Nike", "Vans", "슈프림"]},
  {"id": 11, "code": "K", "nameKo": "아트스쿨 인디 스트릿", "nameEn": "Art-school Indie Street", "brandCount": 207, "womenBrandCount": 100, "menBrandCount": 87, "repBrandWomen": "ADER error", "repBrandMen": "ADER error", "sampleBrandsWomen": ["써저리", "AVAVAV", "INSCRIRE", "Magliano", "Puppets and Puppets", "SRVC"], "sampleBrandsMen": ["써저리", "ALEXANDER DIGENOVA", "AVAVAV", "HARAGO", "Magliano", "Solitude Studios"]},
  {"id": 12, "code": "L", "nameKo": "럭셔리 스트릿", "nameEn": "Luxury Streetwear", "brandCount": 119, "womenBrandCount": 40, "menBrandCount": 61, "repBrandWomen": "Off-White", "repBrandMen": "Fear of God", "sampleBrandsWomen": ["GREG ROSS", "Pushbutton", "STEFAN COOKE", "A MACHINE", "Off-White", "1017 ALYX 9SM"], "sampleBrandsMen": ["PALMER", "STEFAN COOKE", "TSAU", "Youths in Balaclava", "A MACHINE", "Off-White"]},
  {"id": 13, "code": "M", "nameKo": "다크 아방가르드", "nameEn": "Dark Avant-garde", "brandCount": 75, "womenBrandCount": 32, "menBrandCount": 36, "repBrandWomen": "HYEIN SEO", "repBrandMen": "Rick Owens", "sampleBrandsWomen": ["Rick Owens", "YOHJI YAMAMOTO", "McQueen", "Noir Kei Ninomiya", "Rick Owens Drkshdw", "BMUET(TE)"], "sampleBrandsMen": ["Rick Owens", "YOHJI YAMAMOTO", "A DICIANNOVEVENTITRE", "McQueen", "Rick Owens Drkshdw", "99%IS-"]},
  {"id": 14, "code": "N", "nameKo": "벨지언 컨셉추얼", "nameEn": "Belgian Conceptual", "brandCount": 70, "womenBrandCount": 43, "menBrandCount": 40, "repBrandWomen": "MM6", "repBrandMen": "Juun.J", "sampleBrandsWomen": ["AIREI", "Bernhard Willhelm", "Boyarovskaya", "Juun.J", "Niccolo Pasqualetti", "REVENIOMAKER"], "sampleBrandsMen": ["AIREI", "BLUEMARBLE", "CALVINLUO", "Camiel Fortgens", "Juun.J", "REVENIOMAKER"]},
  {"id": 15, "code": "O", "nameKo": "런웨이 익스페리먼탈", "nameEn": "Runway Experimental", "brandCount": 75, "womenBrandCount": 40, "menBrandCount": 38, "repBrandWomen": "Gentle Monster", "repBrandMen": "sacai", "sampleBrandsWomen": ["Paula Canovas Del Vas", "Comme des Garçons", "Issey Miyake", "sacai", "UNDERCOVER", "Bao Bao Issey Miyake"], "sampleBrandsMen": ["B1ARCHIVE", "HUGO KREIT", "Comme des Garçons Homme Plus", "sacai", "Craig Green", "Kuboraum"]},
  {"id": 16, "code": "P", "nameKo": "럭셔리 맥시멀리스트", "nameEn": "Luxury Maximalist", "brandCount": 111, "womenBrandCount": 39, "menBrandCount": 16, "repBrandWomen": "Vivienne Westwood", "repBrandMen": "Gucci", "sampleBrandsWomen": ["Ichiyo", "Sophia Webster", "Dolce&Gabbana", "Balmain", "16Arlington", "Moschino Jeans"], "sampleBrandsMen": ["Dolce&Gabbana", "Balmain", "Valentino", "Versace", "Valentino Garavani", "Kenzo"]},
  {"id": 17, "code": "Q", "nameKo": "로맨틱 페미닌", "nameEn": "Romantic Feminine", "brandCount": 191, "womenBrandCount": 102, "menBrandCount": 10, "repBrandWomen": "KIJUN", "repBrandMen": null, "sampleBrandsWomen": ["1CONCEPT", "Grape", "Jenny Fax", "J KOO", "Juliet Johnstone", "Nicklas Skovgaard"], "sampleBrandsMen": ["Vanya Sundari", "VINNY’s", "ARC Object", "KIJUN", "Apartment 1007", "Jijivisha"]},
  {"id": 18, "code": "R", "nameKo": "센슈얼 페미닌", "nameEn": "Sensual Feminine", "brandCount": 178, "womenBrandCount": 98, "menBrandCount": 10, "repBrandWomen": "SKIMS", "repBrandMen": null, "sampleBrandsWomen": ["BINYA", "DIDU", "DOS SWIM", "Emily Watson", "Miss Sixty", "nastyamasha"], "sampleBrandsMen": ["Versace Underwear", "Dion Lee", "Isa Boulder", "K.NGSLEY", "Alan Crocetti", "Ludovic de Saint Sernin"]},
  {"id": 19, "code": "S", "nameKo": "고프코어 아웃도어", "nameEn": "Gorpcore Outdoor", "brandCount": 190, "womenBrandCount": 56, "menBrandCount": 67, "repBrandWomen": "Arc'teryx", "repBrandMen": "Salomon", "sampleBrandsWomen": ["EMU Australia", "아크테릭스", "PUMA", "Salomon", "오호스", "Cayl"], "sampleBrandsMen": ["A. A. Spectrum", "아크테릭스", "Arc'teryx", "PUMA", "Salomon", "SOAR Running"]},
  {"id": 20, "code": "T", "nameKo": "이탈리안 테크럭셔리", "nameEn": "Italian Tech-luxury", "brandCount": 30, "womenBrandCount": 10, "menBrandCount": 15, "repBrandWomen": "Moncler", "repBrandMen": "Stone Island", "sampleBrandsWomen": ["Moncler", "Stone Island", "TATRAS", "GR10K", "HELIOT EMIL", "Veilance"], "sampleBrandsMen": ["XLIM", "Moncler", "Stone Island", "TATRAS", "Parajumpers", "BYBORRE"]},
  {"id": 21, "code": "U", "nameKo": "한국 영캐주얼", "nameEn": "Korean Young Casual", "brandCount": 185, "womenBrandCount": 158, "menBrandCount": 61, "repBrandWomen": "MARGESHERWOOD", "repBrandMen": "ANDERSSON BELL", "sampleBrandsWomen": ["Epingler", "ERA", "MARGESHERWOOD", "그레일즈", "탄산마그네슘", "999휴머니티"], "sampleBrandsMen": ["ERA", "그레일즈", "탄산마그네슘", "999휴머니티", "JACQUES", "OJOS"]},
] as const;
