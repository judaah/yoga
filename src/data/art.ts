// Сгенерировано tools/art/build.ts — руками не править.
// Иллюстрации поз лежат в public/poses/<id>.webp (большие) и public/poses/s/<id>.webp (для списков).

export const ART_IDS: ReadonlySet<string> = new Set(["sukhasana","breath_nadi","balasana","shavasana","cat_cow","bird_dog","thread_needle","neck_stretch","chest_opener","seated_side_bend","seated_twist_easy","tadasana","urdhva_hastasana","standing_side_bend","uttanasana","ardha_uttanasana","utkatasana","warrior1","warrior2","trikonasana","side_angle","low_lunge","high_lunge","pyramid","wide_fold","goddess","malasana","tree","knee_hug_standing","warrior3","dancer","half_moon","plank","forearm_plank","down_dog","chaturanga","dolphin","navasana","reverse_tabletop","sphinx","cobra","up_dog","locust","bow","camel","dandasana","paschimottanasana","janu_sirsasana","butterfly","wide_seated","pigeon","ardha_matsyendrasana","bridge","apanasana","supine_twist","supta_padangusthasana","figure_four","happy_baby","reclined_butterfly","legs_up","shoulderstand","plow","cat_cow_alt"]);

/** Позы без своей иллюстрации, которые показываются чужой (дыхание сидя → лёгкая поза). */
export const ART_ALIAS: Readonly<Record<string, string>> = {"breath_full":"sukhasana","breath_box":"sukhasana","breath_long_exhale":"sukhasana"};
