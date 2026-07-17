export type LearningCategoryId =
  | 'particles'
  | 'demonstratives'
  | 'questions'
  | 'politeSpeech'
  | 'verbForms'
  | 'requests'
  | 'location'
  | 'timeNumbers'
  | 'expressions'
  | 'writingSystems'

export type LearningLesson = {
  id: string
  lesson_number: number | null
  title: string | null
  lesson_sections?: Array<{
    title?: string | null
    content?: string | null
  }> | null
}

export type LearningMapItem = {
  label: string
  reading: string
  description: string
  lessons: Array<{
    id: string
    number: number
    title: string
  }>
}

export type LearningMapCategory = {
  id: LearningCategoryId
  title: string
  shortTitle: string
  description: string
  items: LearningMapItem[]
}

type LearningDefinition = {
  label: string
  description: string
  match: RegExp
}

type CategoryDefinition = Omit<LearningMapCategory, 'items'> & {
  definitions: LearningDefinition[]
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'particles',
    title: 'Particles',
    shortTitle: 'Particles',
    description: 'Small grammar markers that show topic, object, location, direction, possession, and addition.',
    definitions: [
      { label: 'は', description: 'Topic marker, often understood as "speaking of..."', match: /(^|[\s、。:：・])は($|[\s、。:：・])|topic marker|speaking of/i },
      { label: 'か', description: 'Question marker for polite questions.', match: /(^|[\s、。:：・])か($|[\s、。:：・])|question marker|forming questions/i },
      { label: 'の', description: 'Possessive and relationship marker between nouns.', match: /(^|[\s、。:：・])の($|[\s、。:：・])|possessive|connect two nouns|noun 1 の noun 2/i },
      { label: 'で', description: 'Action-place marker and connector for noun sentences.', match: /(^|[\s、。:：・])で($|[\s、。:：・])|place of action|action locations|connecting sentences/i },
      { label: 'も', description: 'Also / too; often replaces は.', match: /(^|[\s、。:：・])も($|[\s、。:：・])|also|too|instead of wa/i },
      { label: 'を', description: 'Direct object marker.', match: /(^|[\s、。:：・])を($|[\s、。:：・])|direct object/i },
      { label: 'に', description: 'Time, destination, direction, and existence-location marker.', match: /(^|[\s、。:：・])に($|[\s、。:：・])|destination|time .* destination|existence or destination|direction particle/i },
      { label: 'が', description: 'Subject/new-information marker, especially with あります / います.', match: /(^|[\s、。:：・])が($|[\s、。:：・])|subject marking|new information/i },
      { label: 'と', description: 'With / and; used in phrases like A と B and いっしょに.', match: /(^|[\s、。:：・])と($|[\s、。:：・])|with.? particle|between nouns before あいだ/i },
    ],
  },
  {
    id: 'demonstratives',
    title: 'Demonstratives',
    shortTitle: 'This/That',
    description: 'Words for this, that, which, here, there, and location questions.',
    definitions: [
      { label: 'これ', description: 'This item near the speaker.', match: /これ|kore/i },
      { label: 'それ', description: 'That item near the listener.', match: /それ|sore/i },
      { label: 'あれ', description: 'That item over there.', match: /あれ|are/i },
      { label: 'どれ', description: 'Which one?', match: /どれ|dore/i },
      { label: 'この + noun', description: 'This noun.', match: /この|kono/i },
      { label: 'その + noun', description: 'That noun near the listener.', match: /その|sono/i },
      { label: 'あの + noun', description: 'That noun over there.', match: /あの|ano/i },
      { label: 'どの + noun', description: 'Which noun?', match: /どの|dono/i },
      { label: 'ここ / そこ / あそこ / どこ', description: 'Here, there, over there, and where.', match: /ここ|そこ|あそこ|どこ|koko|soko|asoko|doko/i },
    ],
  },
  {
    id: 'questions',
    title: 'Question Words & Forms',
    shortTitle: 'Questions',
    description: 'Question endings and words for who, what, where, age, time, and duration.',
    definitions: [
      { label: 'ですか', description: 'Polite question ending.', match: /ですか|desu ka|polite question/i },
      { label: 'なに / なん', description: 'What; changes form depending on the phrase.', match: /なに|なん|nani|nan(?![a-z])/i },
      { label: 'なんじ', description: 'What time?', match: /なんじ|nanji/i },
      { label: 'なんさい', description: 'How old?', match: /なんさい|nansai/i },
      { label: 'なんじかん', description: 'How many hours?', match: /なんじかん|nanjikan|how many hours/i },
      { label: 'だれ', description: 'Who?', match: /だれ(?!の)|dare(?! no)/i },
      { label: 'だれの', description: 'Whose?', match: /だれの|dare no|whose/i },
      { label: 'どこ', description: 'Where?', match: /どこ|doko|where/i },
    ],
  },
  {
    id: 'politeSpeech',
    title: 'Polite & Casual Speech',
    shortTitle: 'Politeness',
    description: 'Polite sentence endings, casual forms, and present/past negative forms.',
    definitions: [
      { label: 'です', description: 'Polite ending for noun/adjective sentences.', match: /です|desu|polite sentence ending/i },
      { label: 'ます', description: 'Polite verb ending.', match: /ます($|[\s、。:：・])|masu/i },
      { label: 'ません', description: 'Polite negative verb ending.', match: /ません|masen/i },
      { label: 'ました', description: 'Polite past verb ending.', match: /ました|mashita|past tense/i },
      { label: 'ませんでした', description: 'Polite negative past form.', match: /ませんでした|masen deshita|negative past/i },
      { label: 'casual questions', description: 'Casual questions can drop です and か with rising intonation.', match: /casual question|drop です and か|casual endings/i },
    ],
  },
  {
    id: 'verbForms',
    title: 'Verb Forms',
    shortTitle: 'Verbs',
    description: 'Verb groups, endings, invitations, connections, and past-tense patterns.',
    definitions: [
      { label: 'る-verbs', description: 'Ru-verb basics such as たべる.', match: /る-verb|ru-verb|たべる|taberu/i },
      { label: 'う-verbs', description: 'U-verb conjugation such as のむ.', match: /う-verb|u-verb|のむ|nomu/i },
      { label: 'irregular verbs', description: 'Irregular verbs such as する and くる.', match: /irregular verbs|不規則動詞|する|くる/i },
      { label: 'ない form', description: 'Plain negative form.', match: /ない|nai form|negative form/i },
      { label: 'past tense', description: 'Past-tense verbs ending in ました.', match: /past tense|ました|mashita/i },
      { label: 'て-form', description: 'Connects actions, as in いって and まがって.', match: /て-form|te-form|まっすぐいって|magatte/i },
      { label: 'ましょう', description: 'Let’s / invitation form.', match: /ましょう|mashou|invitation form/i },
      { label: 'ませんか', description: 'Polite invitation question.', match: /ませんか|masen ka/i },
      { label: 'verb-final word order', description: 'Japanese verbs usually come at the end.', match: /verb at sentence end|verb always last|verbs? .* end/i },
    ],
  },
  {
    id: 'requests',
    title: 'Requests',
    shortTitle: 'Requests',
    description: 'Forms used to ask for objects, service, repetition, or slower speech.',
    definitions: [
      { label: 'ください', description: 'Please give/do; best for physical items and direct requests.', match: /ください|kudasai|physical items/i },
      { label: 'おねがいします', description: 'Polite flexible request phrase.', match: /おねがいします|onegaishimasu|flexible requests|general requests/i },
      { label: 'ゆっくり', description: 'Ask someone to speak slowly.', match: /ゆっくり|yukkuri|slower speech/i },
      { label: 'わかりません', description: 'I do not understand.', match: /わかりません|wakarimasen|do not understand/i },
    ],
  },
  {
    id: 'location',
    title: 'Location & Existence',
    shortTitle: 'Location',
    description: 'Existence verbs, directions, and position phrases.',
    definitions: [
      { label: 'あります', description: 'There is/are for things.', match: /あります|arimasu|inanimate|non-living things/i },
      { label: 'います', description: 'There is/are for people and animals.', match: /います|imasu|people or animals|animate/i },
      { label: '〜のうえ', description: 'On / above.', match: /うえ|ue|above|on top/i },
      { label: '〜のした', description: 'Under.', match: /した|shita|under/i },
      { label: '〜のとなり', description: 'Next to.', match: /となり|tonari|next to|beside/i },
      { label: '〜のなか', description: 'Inside.', match: /なか|naka|inside/i },
      { label: '〜のまえ', description: 'In front of.', match: /まえ|mae|in front/i },
      { label: 'あいだ', description: 'Between.', match: /あいだ|aida|between/i },
      { label: 'まっすぐ / みぎ / ひだり', description: 'Straight, right, and left.', match: /まっすぐ|みぎ|ひだり|massugu|migi|hidari|directions/i },
    ],
  },
  {
    id: 'timeNumbers',
    title: 'Time, Numbers & Duration',
    shortTitle: 'Time',
    description: 'Numbers, prices, time, minutes, age, and duration expressions.',
    definitions: [
      { label: 'numbers & prices', description: 'Counting, prices, yen, and irregular number readings.', match: /numbers|counting|prices|えん|いくら|さんびゃく|yen|phone numbers/i },
      { label: 'time of day', description: 'Time expressions with なんじ, ごぜん, ごご, and 半.', match: /time|なんじ|ごぜん|ごご|半|nanji|gozen|gogo|half past/i },
      { label: 'minutes', description: 'Minute readings with ふん / ぷん.', match: /ふん|ぷん|minutes|fun\/pun/i },
      { label: 'age', description: 'Age questions with なんさい.', match: /age|なんさい|nansai/i },
      { label: 'ごろ', description: 'Around a clock time.', match: /ごろ|goro|around.*time|clock time/i },
      { label: 'ぐらい', description: 'About / approximately for duration or amount.', match: /ぐらい|gurai|duration|approximately/i },
      { label: 'じかん', description: 'Counting hours.', match: /じかん|jikan|hours/i },
    ],
  },
  {
    id: 'expressions',
    title: 'Expressions',
    shortTitle: 'Expressions',
    description: 'Set phrases for greetings, restaurants, home, classroom, and casual conversation.',
    definitions: [
      { label: 'introductions', description: 'Meeting someone for the first time.', match: /はじめまして|よろしくお願いします|introductions|nice to meet/i },
      { label: 'daily greetings', description: 'Good morning, hello, good evening, goodbye.', match: /おはよう|こんにちは|こんばんは|さようなら|greetings/i },
      { label: 'thanks & replies', description: 'Thank you, no worries, and you’re welcome.', match: /ありがとうございます|どういたしまして|いいえ|大丈夫です|thank you/i },
      { label: 'restaurant phrases', description: 'Before/after eating and ordering situations.', match: /いただきます|ごちそうさま|restaurant|ordering/i },
      { label: 'home greetings', description: 'Leaving, coming home, and welcoming someone back.', match: /いってきます|いってらっしゃい|ただいま|おかえり|home greetings/i },
      { label: 'classroom expressions', description: 'Useful phrases for asking and understanding in class.', match: /classroom expressions|わかりません|ゆっくり/i },
      { label: 'casual how-was questions', description: 'Asking how something was with どうだった.', match: /どうだった|how was/i },
      { label: 'また来週', description: 'See you next week.', match: /また来週|mata raishū|see you next week/i },
    ],
  },
  {
    id: 'writingSystems',
    title: 'Writing Systems',
    shortTitle: 'Writing',
    description: 'Kana, kanji, and sound rows introduced in the lessons.',
    definitions: [
      { label: 'hiragana', description: 'Native Japanese syllabary.', match: /ひらがな|hiragana|あ・い・う・え・お/i },
      { label: 'katakana', description: 'Used for foreign names and borrowed words.', match: /カタカナ|katakana|foreign names|borrowed words/i },
      { label: 'kanji', description: 'Chinese characters used in Japanese.', match: /漢字|kanji/i },
      { label: 'kana sound rows', description: 'Vowels and consonant rows such as あ-row and か-row.', match: /hiragana sounds|basic vowel|consonant rows|か・き・く・け・こ|さ・し・す・せ・そ/i },
    ],
  },
]

export function buildJapaneseLearningMap(lessons: LearningLesson[]): LearningMapCategory[] {
  const lessonsAscending = [...lessons].sort((a, b) => (a.lesson_number ?? 0) - (b.lesson_number ?? 0))

  return CATEGORY_DEFINITIONS.map(category => {
    const items = category.definitions.map(definition => {
      const foundLessons = lessonsAscending.flatMap(lesson => {
        const haystack = [
          lesson.title,
          ...(lesson.lesson_sections ?? []).flatMap(section => [section.title, section.content]),
        ]
          .filter(Boolean)
          .join('\n')

        if (!definition.match.test(haystack)) return []

        return [{
          id: lesson.id,
          number: lesson.lesson_number ?? 0,
          title: lesson.title || `Lesson ${lesson.lesson_number ?? ''}`.trim(),
        }]
      })

      return {
        label: definition.label,
        reading: readingForLabel(definition.label),
        description: definition.description,
        lessons: foundLessons,
      }
    }).filter(item => item.lessons.length > 0)

    return {
      id: category.id,
      title: category.title,
      shortTitle: category.shortTitle,
      description: category.description,
      items,
    }
  }).filter(category => category.items.length > 0)
}

function readingForLabel(label: string) {
  const exact: Record<string, string> = {
    'は': 'wa',
    'か': 'ka',
    'の': 'no',
    'で': 'de',
    'も': 'mo',
    'を': 'o',
    'に': 'ni',
    'が': 'ga',
    'と': 'to',
    'これ': 'kore',
    'それ': 'sore',
    'あれ': 'are',
    'どれ': 'dore',
    'この + noun': 'kono + noun',
    'その + noun': 'sono + noun',
    'あの + noun': 'ano + noun',
    'どの + noun': 'dono + noun',
    'ここ / そこ / あそこ / どこ': 'koko / soko / asoko / doko',
    'ですか': 'desu ka',
    'なに / なん': 'nani / nan',
    'なんじ': 'nanji',
    'なんさい': 'nansai',
    'なんじかん': 'nanjikan',
    'だれ': 'dare',
    'だれの': 'dare no',
    'どこ': 'doko',
    'です': 'desu',
    'ます': 'masu',
    'ません': 'masen',
    'ました': 'mashita',
    'ませんでした': 'masen deshita',
    'る-verbs': 'ru-verbs',
    'う-verbs': 'u-verbs',
    'ない form': 'nai form',
    'て-form': 'te-form',
    'ましょう': 'mashou',
    'ませんか': 'masen ka',
    'ください': 'kudasai',
    'おねがいします': 'onegaishimasu',
    'ゆっくり': 'yukkuri',
    'わかりません': 'wakarimasen',
    'あります': 'arimasu',
    'います': 'imasu',
    '〜のうえ': 'no ue',
    '〜のした': 'no shita',
    '〜のとなり': 'no tonari',
    '〜のなか': 'no naka',
    '〜のまえ': 'no mae',
    'あいだ': 'aida',
    'まっすぐ / みぎ / ひだり': 'massugu / migi / hidari',
    'ごろ': 'goro',
    'ぐらい': 'gurai',
    'じかん': 'jikan',
    'また来週': 'mata raishuu',
  }

  return exact[label] || label
}

export function learningMapTotals(categories: LearningMapCategory[]) {
  const itemCount = categories.reduce((sum, category) => sum + category.items.length, 0)
  const lessonIds = new Set<string>()

  for (const category of categories) {
    for (const item of category.items) {
      for (const lesson of item.lessons) lessonIds.add(lesson.id)
    }
  }

  return {
    categoryCount: categories.length,
    itemCount,
    lessonCount: lessonIds.size,
  }
}
