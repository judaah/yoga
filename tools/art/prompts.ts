import { POSES } from '../../src/data/poses';

// Описания поз для генерации иллюстраций. По-английски: модели лучше знают позы по английским
// и санскритским названиям. Ракурс и сторона — как у фигурки-референса из src/data/poses.ts.

/** Иллюстрация → какая фигурка служит референсом позы (по умолчанию — поза с тем же id). */
export const ART_REF: Record<string, { pose: string; alt?: boolean }> = {
  cat_cow_alt: { pose: 'cat_cow', alt: true },
};

/** Поза → какой иллюстрацией её показывать, если своей нет (дыхательные практики сидя). */
export const ART_ALIAS: Record<string, string> = {
  breath_full: 'sukhasana',
  breath_box: 'sukhasana',
  breath_long_exhale: 'sukhasana',
};

/** Все иллюстрации, которые нужны приложению. */
export const ART_IDS = [...POSES.filter((p) => !ART_ALIAS[p.id]).map((p) => p.id), ...Object.keys(ART_REF)];

export const STYLE = [
  'Flat vector illustration for a calm, modern yoga app.',
  'One woman, about 30, slim athletic build, dark brown hair in a low bun, wearing a sage green fitted tank top and dark charcoal-gray leggings, barefoot.',
  'She practices on a light beige yoga mat.',
  'Plain solid warm off-white background (#F3F1EA) and nothing else: no plants, no props unless named, no text, no logo, no frame, no border.',
  'Clean simple shapes, soft muted palette, subtle soft shading, a gentle shadow under the body.',
  'Full body visible with a generous margin on all sides, centered; the mat lies horizontally across the lower part of the picture.',
  'Anatomically correct proportions, correct number of arms, legs, hands and feet.',
].join(' ');

export const PROMPTS: Record<string, string> = {
  sukhasana: 'Easy Pose (Sukhasana): sitting cross-legged on the mat, spine tall, hands resting on the knees, eyes closed, calm face. Front view.',
  breath_nadi:
    'Alternate nostril breathing (Nadi Shodhana): sitting cross-legged, right hand raised to the nose with the thumb closing the right nostril, left hand resting on the left knee, eyes closed. Front view.',
  balasana: "Child's Pose (Balasana): kneeling, hips resting on the heels, torso folded forward over the thighs, forehead on the mat, arms extended forward on the mat. Side view, head to the right.",
  shavasana: 'Corpse Pose (Savasana): lying flat on the back on the mat, arms slightly away from the body with palms up, legs relaxed apart, eyes closed. Top-down view from directly above, head to the left.',
  cat_cow:
    'Cow Pose (Bitilasana): on hands and knees, wrists under shoulders, knees under hips, belly dropping toward the mat, back gently arched (concave), chest and gaze lifted forward. Side view, head to the right.',
  cat_cow_alt: 'Cat Pose (Marjaryasana): on hands and knees, spine rounded up high toward the ceiling (convex), head dropped down, chin toward the chest. Side view, head to the right.',
  bird_dog: 'Bird Dog: on hands and knees, one arm extended straight forward and the opposite leg extended straight back, both parallel to the floor. Side view, head to the right.',
  thread_needle:
    'Thread the Needle: from hands and knees, one arm threaded under the body along the mat, that shoulder and the side of the head resting on the mat, hips stay high above the knees, the other hand on the mat ahead. Side view, head to the right.',
  neck_stretch:
    'Seated neck stretch: sitting cross-legged, head tilted sideways toward one shoulder, the opposite arm reaching down to the floor beside the hip, shoulders relaxed. Front view.',
  chest_opener:
    'Standing chest opener: standing tall, fingers interlaced behind the back, straight arms reaching back and down, chest lifted, shoulder blades squeezed together. Side view, facing right.',
  seated_side_bend: 'Seated side bend: sitting cross-legged, one hand on the floor beside the hip, the other arm arching overhead toward that side. Front view.',
  seated_twist_easy: 'Easy seated twist: sitting cross-legged, torso twisted to one side, the opposite hand on the knee, the other hand on the floor behind. Front view.',
  tadasana: 'Mountain Pose (Tadasana): standing tall, feet hip-width apart and parallel, arms by the sides, palms slightly forward. Front view.',
  urdhva_hastasana: 'Upward Salute (Urdhva Hastasana): standing tall, both arms raised straight overhead, palms facing each other. Front view.',
  standing_side_bend: 'Standing side bend: standing, both arms overhead with fingers interlaced, the whole body arching to one side like a crescent. Front view.',
  uttanasana:
    'Standing Forward Fold (Uttanasana): standing with legs straight, torso folded down over the legs, head hanging, hands holding the opposite elbows. Side view, facing right.',
  ardha_uttanasana: 'Half Forward Fold (Ardha Uttanasana): standing, flat back parallel to the floor, hands resting on the shins just below the knees, neck long. Side view, facing right.',
  utkatasana:
    'Chair Pose (Utkatasana): feet together, knees bent deeply, hips back as if sitting on a chair, torso leaning forward, arms raised overhead in line with the torso. Side view, facing right.',
  warrior1:
    'Warrior I (Virabhadrasana I): long lunge, front knee bent at 90 degrees over the ankle, back leg straight with the back heel down, torso upright, both arms raised straight overhead. Side view, front leg to the right.',
  warrior2:
    'Warrior II (Virabhadrasana II): wide stance, front knee bent over the ankle, back leg straight, arms extended horizontally to the sides at shoulder height, gaze over the front hand. Front view.',
  trikonasana:
    'Triangle Pose (Trikonasana): wide stance with both legs straight, torso tilted sideways over the front leg, lower hand on the shin, upper arm straight up toward the ceiling, both arms in one vertical line. Front view.',
  side_angle:
    'Extended Side Angle (Utthita Parsvakonasana): front knee bent at 90 degrees, back leg straight, lower hand on the floor inside the front foot, top arm extended diagonally over the ear in one line with the back leg. Front view.',
  low_lunge:
    'Low Lunge (Anjaneyasana): front foot forward with the knee bent over the ankle, back knee and shin resting on the mat, hips sinking forward, torso upright, arms raised overhead. Side view, front leg to the right.',
  high_lunge:
    'High Lunge: front knee bent over the ankle, back leg straight on the ball of the foot with the heel lifted, torso leaning slightly forward, arms reaching up in one line with the back leg. Side view, front leg to the right.',
  pyramid:
    'Pyramid Pose (Parsvottanasana): both legs straight, one foot forward and one back, torso folded forward over the front leg with a flat back, fingertips on the floor beside the front foot. Side view, front leg to the right.',
  wide_fold:
    'Wide-Legged Forward Fold (Prasarita Padottanasana): legs wide apart and straight, torso folded down between the legs, crown of the head toward the floor, hands flat on the floor. Front view.',
  goddess:
    'Goddess Pose (Utkata Konasana): wide stance with toes turned out, knees bent deeply over the toes, torso upright, arms in a cactus shape (elbows bent 90 degrees at shoulder height, hands up). Front view.',
  malasana:
    'Garland Pose (Malasana): deep squat, feet a little wider than the hips, heels down, knees wide, palms pressed together at the chest, elbows pressing the knees apart. Front view.',
  tree: 'Tree Pose (Vrikshasana): standing on one straight leg, the other foot pressed against the inner thigh of the standing leg with that knee pointing out to the side, palms together overhead. Front view.',
  knee_hug_standing: 'Standing knee to chest: balancing on one straight leg, the other knee pulled up to the chest with both arms hugging the shin. Side view, facing right.',
  warrior3:
    'Warrior III (Virabhadrasana III): balancing on one straight leg, torso and the other leg extended in one straight line parallel to the floor, arms extended forward. Side view, facing right.',
  dancer:
    'Dancer Pose (Natarajasana): balancing on one leg, the other knee bent with that foot held behind the body by the same-side hand and kicked up high, torso leaning forward, free arm reaching forward and up. Side view, facing right.',
  half_moon:
    'Half Moon Pose (Ardha Chandrasana): balancing on one straight leg with the lower hand on the floor, the other leg lifted parallel to the floor, top arm reaching straight up, body open to the viewer. Front view.',
  plank: 'Plank Pose: straight arms with hands under the shoulders, body in one straight line from head to heels, on the toes. Side view, head to the right.',
  forearm_plank: 'Forearm Plank: on the forearms with elbows under the shoulders, body in one straight line from head to heels, on the toes. Side view, head to the right.',
  down_dog:
    'Downward-Facing Dog (Adho Mukha Svanasana): inverted V shape, hands and feet on the mat, hips lifted high, arms and back in one straight line, legs straight, heels toward the floor, head between the arms. Side view, hands to the right.',
  chaturanga:
    'Chaturanga Dandasana: low plank, body straight and parallel to the floor hovering just above it, elbows bent at 90 degrees and hugging the ribs, on the toes. Side view, head to the right.',
  dolphin: 'Dolphin Pose: like downward dog but on the forearms, hips lifted high, head hanging between the arms, legs straight. Side view, forearms to the right.',
  navasana:
    'Boat Pose (Navasana): balancing on the sit bones, torso leaning back with a straight spine, straight legs lifted up at 45 degrees forming a V, arms extended forward parallel to the floor. Side view, facing right.',
  reverse_tabletop:
    'Reverse Tabletop: hands on the mat behind the hips with straight arms, feet flat on the floor with knees bent at 90 degrees, hips lifted so the torso and thighs form a flat tabletop facing up. Side view, feet to the right.',
  sphinx: 'Sphinx Pose: lying on the belly, propped up on the forearms with elbows under the shoulders, chest lifted, legs extended back on the mat. Side view, head to the right.',
  cobra: 'Cobra Pose (Bhujangasana): lying on the belly, hands under the shoulders with elbows bent close to the body, chest lifted in a low backbend, hips and legs on the mat. Side view, head to the right.',
  up_dog:
    'Upward-Facing Dog (Urdhva Mukha Svanasana): straight arms with hands under the shoulders, chest lifted forward and up, thighs and hips lifted off the floor, tops of the feet on the mat. Side view, head to the right.',
  locust: 'Locust Pose (Salabhasana): lying on the belly, chest, arms and legs all lifted off the mat, arms reaching back alongside the body. Side view, head to the right.',
  bow: 'Bow Pose (Dhanurasana): lying on the belly, knees bent, hands holding the ankles behind, chest and thighs lifted so the body forms a bow shape. Side view, head to the right.',
  camel:
    'Camel Pose (Ustrasana): kneeling upright with hips over the knees, back arched, hands reaching back to hold the heels, chest open to the ceiling, head gently dropped back. Side view, facing right.',
  dandasana: 'Staff Pose (Dandasana): sitting upright with straight legs extended forward together, feet flexed, hands on the floor beside the hips, spine tall. Side view, legs to the right.',
  paschimottanasana: 'Seated Forward Bend (Paschimottanasana): sitting with straight legs forward, torso folded forward over the legs, hands reaching to the feet. Side view, legs to the right.',
  janu_sirsasana:
    'Head-to-Knee Forward Bend (Janu Sirsasana): sitting with one leg straight forward and the other knee bent with its sole against the inner thigh, folding forward over the straight leg, hands to the foot. Side view, straight leg to the right.',
  butterfly:
    'Bound Angle / Butterfly Pose (Baddha Konasana): sitting upright, soles of the feet pressed together close to the body, knees dropped open to the sides, hands holding the feet. Front view.',
  wide_seated:
    'Wide-Angle Seated Forward Bend (Upavistha Konasana): sitting with legs spread wide apart and straight, toes pointing up, folding forward with a long spine, hands on the floor in front. Front view.',
  pigeon:
    'Pigeon Pose (Eka Pada Rajakapotasana prep): front leg folded on the mat with the shin lying across the front of the mat, back leg extended straight behind on the mat, hips square, torso upright, fingertips on the floor beside the hips. Side view, facing right.',
  ardha_matsyendrasana:
    'Half Lord of the Fishes (Ardha Matsyendrasana): seated twist, one knee up with that foot planted outside the opposite knee, the opposite arm hugging the raised knee, the other hand on the floor behind, torso twisted. Side view, facing right.',
  bridge:
    'Bridge Pose (Setu Bandhasana): lying on the back, knees bent, feet flat on the mat, hips lifted high, shoulders and head on the mat, arms along the floor. Side view, head to the left, feet to the right.',
  apanasana: 'Knees-to-Chest Pose (Apanasana): lying on the back, both knees hugged into the chest with the arms wrapped around the shins. Side view, head to the left.',
  supine_twist:
    'Supine Spinal Twist (Supta Matsyendrasana): lying on the back, arms spread wide in a T, both bent knees dropped together to one side, head turned the opposite way. Top-down view from directly above, head to the left.',
  supta_padangusthasana:
    'Reclining hamstring stretch (Supta Padangusthasana): lying on the back, one leg raised straight up to the ceiling with a yoga strap around the foot held by both hands, the other leg straight on the mat. Side view, head to the left.',
  figure_four:
    'Reclining Figure Four (supine pigeon): lying on the back, one ankle crossed over the opposite knee, hands clasped behind the thigh of the supporting leg pulling it toward the chest. Side view, head to the left.',
  happy_baby:
    'Happy Baby Pose (Ananda Balasana): lying on the back, knees bent wide toward the armpits, shins vertical, hands holding the outer edges of the feet, soles facing the ceiling. Side view, head to the left.',
  reclined_butterfly:
    'Reclined Bound Angle (Supta Baddha Konasana): lying on the back, soles of the feet together, knees falling open to the sides, arms relaxed. Top-down view from directly above, head to the left.',
  legs_up:
    'Legs Up the Wall (Viparita Karani): lying on the back with both straight legs raised vertically and resting against a plain wall, arms relaxed on the floor. Side view, head to the left, the wall on the right.',
  shoulderstand:
    'Supported Shoulderstand (Salamba Sarvangasana): resting on the shoulders and upper arms, torso and legs straight up vertically, hands supporting the lower back, elbows on the mat. Side view.',
  plow: 'Plow Pose (Halasana): resting on the shoulders, hips lifted above the shoulders, straight legs extended overhead with toes touching the floor beyond the head, arms on the mat. Side view.',
};
