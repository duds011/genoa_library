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
  reading: string
  description: string
  match: RegExp
}

type CategoryDefinition = Omit<LearningMapCategory, 'items'> & {
  definitions: LearningDefinition[]
}

const jpToken = String.raw`(?:^|[\s、。:：・（）()[\]{}"'!?！？/\\-])`
const jpEnd = String.raw`(?:$|[\s、。:：・（）()[\]{}"'!?！？/\\-])`

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'particles',
    title: 'Particles',
    shortTitle: 'Particles',
    description: 'Small grammar markers that show topic, object, location, direction, possession, and addition.',
    definitions: [
      { label: 'は', reading: 'wa', description: 'Topic marker, often understood as "speaking of..."', match: new RegExp(`${jpToken}は${jpEnd}|topic marker|particle wa|speaking of`, 'i') },
      { label: 'か', reading: 'ka', description: 'Question marker for polite questions.', match: new RegExp(`${jpToken}か${jpEnd}|question marker|particle ka|forming questions`, 'i') },
      { label: 'の', reading: 'no', description: 'Possessive and relationship marker between nouns.', match: new RegExp(`${jpToken}の${jpEnd}|possessive|particle no|noun 1 no noun 2|noun 1 の noun 2`, 'i') },
      { label: 'で', reading: 'de', description: 'Action-place marker and connector for noun sentences.', match: new RegExp(`${jpToken}で${jpEnd}|place of action|action location|particle de|connecting sentences`, 'i') },
      { label: 'も', reading: 'mo', description: 'Also / too; often replaces は.', match: new RegExp(`${jpToken}も${jpEnd}|also|too|particle mo|instead of wa`, 'i') },
      { label: 'を', reading: 'o', description: 'Direct object marker.', match: new RegExp(`${jpToken}を${jpEnd}|direct object|particle wo|particle o`, 'i') },
      { label: 'に', reading: 'ni', description: 'Time, destination, direction, and existence-location marker.', match: new RegExp(`${jpToken}に${jpEnd}|destination|particle ni|time .* destination|existence location|direction particle`, 'i') },
      { label: 'が', reading: 'ga', description: 'Subject/new-information marker, especially with あります / います.', match: new RegExp(`${jpToken}が${jpEnd}|subject marker|particle ga|new information`, 'i') },
      { label: 'と', reading: 'to', description: 'With / and; used in phrases like A と B and いっしょに.', match: new RegExp(`${jpToken}と${jpEnd}|with.? particle|particle to|between nouns|and marker`, 'i') },
    ],
  },
  {
    id: 'demonstratives',
    title: 'Demonstratives',
    shortTitle: 'This/That',
    description: 'Words for this, that, which, here, there, and location questions.',
    definitions: [
      { label: 'これ', reading: 'kore', description: 'This item near the speaker.', match: /これ|kore|this item/i },
      { label: 'それ', reading: 'sore', description: 'That item near the listener.', match: /それ|sore|that item near/i },
      { label: 'あれ', reading: 'are', description: 'That item over there.', match: /あれ|are|that over there/i },
      { label: 'どれ', reading: 'dore', description: 'Which one?', match: /どれ|dore|which one/i },
      { label: 'この + noun', reading: 'kono + noun', description: 'This noun.', match: /この|kono|this noun/i },
      { label: 'その + noun', reading: 'sono + noun', description: 'That noun near the listener.', match: /その|sono|that noun/i },
      { label: 'あの + noun', reading: 'ano + noun', description: 'That noun over there.', match: /あの|ano|that noun over there/i },
      { label: 'どの + noun', reading: 'dono + noun', description: 'Which noun?', match: /どの|dono|which noun/i },
      { label: 'ここ / そこ / あそこ / どこ', reading: 'koko / soko / asoko / doko', description: 'Here, there, over there, and where.', match: /ここ|そこ|あそこ|どこ|koko|soko|asoko|doko/i },
    ],
  },
  {
    id: 'questions',
    title: 'Question Words & Forms',
    shortTitle: 'Questions',
    description: 'Question endings and words for who, what, where, age, time, and duration.',
    definitions: [
      { label: 'ですか', reading: 'desu ka', description: 'Polite question ending.', match: /ですか|desu ka|polite question/i },
      { label: 'なに / なん', reading: 'nani / nan', description: 'What; changes form depending on the phrase.', match: /なに|なん|nani|nan(?![a-z])/i },
      { label: 'なんじ', reading: 'nanji', description: 'What time?', match: /なんじ|何時|nanji|what time/i },
      { label: 'なんさい', reading: 'nansai', description: 'How old?', match: /なんさい|何歳|nansai|how old/i },
      { label: 'なんじかん', reading: 'nanjikan', description: 'How many hours?', match: /なんじかん|何時間|nanjikan|how many hours/i },
      { label: 'だれ', reading: 'dare', description: 'Who?', match: /だれ(?!の)|誰(?!の)|dare(?! no)|who\?/i },
      { label: 'だれの', reading: 'dare no', description: 'Whose?', match: /だれの|誰の|dare no|whose/i },
      { label: 'どこ', reading: 'doko', description: 'Where?', match: /どこ|doko|where/i },
    ],
  },
  {
    id: 'politeSpeech',
    title: 'Polite & Casual Speech',
    shortTitle: 'Politeness',
    description: 'Polite sentence endings, casual forms, and present/past negative forms.',
    definitions: [
      { label: 'です', reading: 'desu', description: 'Polite ending for noun/adjective sentences.', match: /です|desu|polite sentence ending/i },
      { label: 'ます', reading: 'masu', description: 'Polite verb ending.', match: /ます|masu|polite verb/i },
      { label: 'ません', reading: 'masen', description: 'Polite negative verb ending.', match: /ません|masen|polite negative/i },
      { label: 'ました', reading: 'mashita', description: 'Polite past verb ending.', match: /ました|mashita|past polite/i },
      { label: 'ませんでした', reading: 'masen deshita', description: 'Polite negative past form.', match: /ませんでした|masen deshita|negative past/i },
      { label: 'casual questions', reading: 'casual questions', description: 'Casual questions can drop です and か with rising intonation.', match: /casual question|drop です and か|drop desu and ka|casual endings/i },
    ],
  },
  {
    id: 'verbForms',
    title: 'Verb Forms',
    shortTitle: 'Verbs',
    description: 'Verb groups, endings, invitations, connections, and past-tense patterns.',
    definitions: [
      { label: 'る-verbs', reading: 'ru-verbs', description: 'Ru-verb basics such as たべる.', match: /る-verb|ru-verb|たべる|食べる|taberu/i },
      { label: 'う-verbs', reading: 'u-verbs', description: 'U-verb conjugation such as のむ.', match: /う-verb|u-verb|のむ|飲む|nomu/i },
      { label: 'irregular verbs', reading: 'irregular verbs', description: 'Irregular verbs such as する and くる.', match: /irregular verbs|する|くる|kuru|suru/i },
      { label: 'ない form', reading: 'nai form', description: 'Plain negative form.', match: /ない form|nai form|plain negative|negative form/i },
      { label: 'past tense', reading: 'past tense', description: 'Past-tense verbs ending in ました.', match: /past tense|ました|mashita/i },
      { label: 'て-form', reading: 'te-form', description: 'Connects actions, as in いって and まがって.', match: /て-form|te-form|いって|まがって|曲がって|magatte/i },
      { label: 'ましょう', reading: 'mashou', description: "Let's / invitation form.", match: /ましょう|mashou|invitation form|let's/i },
      { label: 'ませんか', reading: 'masen ka', description: 'Polite invitation question.', match: /ませんか|masen ka/i },
      { label: 'verb-final word order', reading: 'verb-final word order', description: 'Japanese verbs usually come at the end.', match: /verb at sentence end|verb always last|verbs? .* end|verb-final/i },
    ],
  },
  {
    id: 'requests',
    title: 'Requests',
    shortTitle: 'Requests',
    description: 'Forms used to ask for objects, service, repetition, or slower speech.',
    definitions: [
      { label: 'ください', reading: 'kudasai', description: 'Please give/do; best for physical items and direct requests.', match: /ください|kudasai|physical items|direct request/i },
      { label: 'お願いします', reading: 'onegaishimasu', description: 'Polite flexible request phrase.', match: /お願いします|おねがいします|onegaishimasu|flexible requests|general requests/i },
      { label: 'ゆっくり', reading: 'yukkuri', description: 'Ask someone to speak slowly.', match: /ゆっくり|yukkuri|slowly|slower speech/i },
      { label: 'わかりません', reading: 'wakarimasen', description: 'I do not understand.', match: /わかりません|分かりません|wakarimasen|do not understand|don't understand/i },
      { label: 'もう一度', reading: 'mou ichido', description: 'Ask someone to repeat something one more time.', match: /もう一度|もういちど|mou ichido|one more time|repeat/i },
    ],
  },
  {
    id: 'location',
    title: 'Location & Existence',
    shortTitle: 'Location',
    description: 'Existence verbs, directions, and position phrases.',
    definitions: [
      { label: 'あります', reading: 'arimasu', description: 'There is/are for things.', match: /あります|arimasu|inanimate|non-living things/i },
      { label: 'います', reading: 'imasu', description: 'There is/are for people.', match: /います|imasu|people|animate/i },
      { label: '〜のうえ', reading: 'no ue', description: 'On / above.', match: /うえ|上|ue|above|on top/i },
      { label: '〜のした', reading: 'no shita', description: 'Under.', match: /した|下|shita|under/i },
      { label: '〜のとなり', reading: 'no tonari', description: 'Next to.', match: /となり|隣|tonari|next to|beside/i },
      { label: '〜のなか', reading: 'no naka', description: 'Inside.', match: /なか|中|naka|inside/i },
      { label: '〜のまえ', reading: 'no mae', description: 'In front of.', match: /まえ|前|mae|in front/i },
      { label: 'あいだ', reading: 'aida', description: 'Between.', match: /あいだ|間|aida|between/i },
      { label: 'まっすぐ / みぎ / ひだり', reading: 'massugu / migi / hidari', description: 'Straight, right, and left.', match: /まっすぐ|みぎ|右|ひだり|左|massugu|migi|hidari|directions/i },
    ],
  },
  {
    id: 'timeNumbers',
    title: 'Time, Numbers & Duration',
    shortTitle: 'Time',
    description: 'Numbers, prices, clock time, minutes, age, and duration expressions.',
    definitions: [
      { label: 'numbers', reading: 'ichi, ni, san...', description: 'Basic numbers and irregular number readings.', match: /basic numbers|number readings|counting|いち|に|さん|よん|ご|ろく|なな|はち|きゅう|じゅう|ichi|ni|san|yon|go|roku|nana|hachi|kyuu|juu/i },
      { label: 'prices / yen', reading: 'ikura / en', description: 'Prices, yen, and asking how much.', match: /prices?|yen|いくら|円|えん|ikura|en\b|how much/i },
      { label: 'clock time', reading: 'nanji / ji', description: 'Clock time with なんじ, ごぜん, ごご, and はん.', match: /なんじ|何時|[一二三四五六七八九十0-9]+時|ごぜん|午前|ごご|午後|はん|半|nanji|gozen|gogo|half past|clock time/i },
      { label: 'minutes', reading: 'fun / pun', description: 'Minute readings with ふん / ぷん.', match: /ふん|ぷん|分|fun\/pun|minutes?|ippun|sanpun|yonpun|gofun|juppun/i },
      { label: 'age', reading: 'sai / nansai', description: 'Age questions and age counting.', match: /なんさい|何歳|歳|さい|nansai|sai\b|age/i },
      { label: 'duration', reading: 'jikan', description: 'Counting hours or amount of time.', match: /じかん|時間|なんじかん|何時間|jikan|nanjikan|how many hours|duration/i },
      { label: 'around / about', reading: 'goro / gurai', description: 'Approximate time or amount.', match: /ごろ|ぐらい|くらい|goro|gurai|kurai|around a clock time|approximately|about/i },
    ],
  },
  {
    id: 'expressions',
    title: 'Expressions',
    shortTitle: 'Expressions',
    description: 'Set phrases for greetings, home, restaurants, classroom, and casual conversation.',
    definitions: [
      { label: 'はじめまして', reading: 'hajimemashite', description: 'Nice to meet you / meeting someone for the first time.', match: /はじめまして|hajimemashite|nice to meet/i },
      { label: 'よろしくお願いします', reading: 'yoroshiku onegaishimasu', description: 'Polite phrase used after introductions or when asking for cooperation.', match: /よろしくお願いします|よろしくおねがいします|yoroshiku|please treat me well/i },
      { label: 'おはよう / こんにちは / こんばんは', reading: 'ohayou / konnichiwa / konbanwa', description: 'Daily greetings for morning, daytime, and evening.', match: /おはよう|こんにちは|こんばんは|ohayou|ohayo|konnichiwa|konbanwa|good morning|hello|good evening/i },
      { label: 'ありがとうございます', reading: 'arigatou gozaimasu', description: 'Thank you.', match: /ありがとうございます|ありがとう|arigatou|arigato|thank you/i },
      { label: 'すみません / ごめんなさい', reading: 'sumimasen / gomennasai', description: 'Excuse me, sorry, or apology phrases.', match: /すみません|ごめんなさい|sumimasen|gomennasai|excuse me|sorry/i },
      { label: 'どういたしまして / いいえ', reading: 'dou itashimashite / iie', description: "You're welcome / no problem style replies.", match: /どういたしまして|いいえ|dou itashimashite|you're welcome|you are welcome|no worries/i },
      { label: 'いただきます / ごちそうさまでした', reading: 'itadakimasu / gochisousama deshita', description: 'Before and after eating.', match: /いただきます|ごちそうさまでした|ごちそうさま|itadakimasu|gochisou|before eating|after eating/i },
      { label: 'いってきます / いってらっしゃい', reading: 'ittekimasu / itterasshai', description: 'Leaving home and seeing someone off.', match: /いってきます|いってらっしゃい|ittekimasu|itterasshai|leaving home/i },
      { label: 'ただいま / おかえり', reading: 'tadaima / okaeri', description: 'Coming home and welcoming someone back.', match: /ただいま|おかえり|tadaima|okaeri|coming home|welcome back/i },
      { label: 'また来週', reading: 'mata raishuu', description: 'See you next week.', match: /また来週|またらいしゅう|mata raishuu|mata raishu|see you next week/i },
      { label: 'どうだった', reading: 'dou datta', description: 'Casual "How was it?" question.', match: /どうだった|dou datta|how was/i },
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
        reading: definition.reading,
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
