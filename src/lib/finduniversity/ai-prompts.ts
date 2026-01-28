// AI Prompts for FindUniversity features

interface CourseInfo {
  name: string;
  universityName?: string;
  level?: string;
  area?: string;
  subArea?: string;
  duration?: string;
  modality?: string;
  city?: string;
  credits?: number;
  price?: string;
}

interface UniversityInfo {
  name: string;
  shortName?: string;
  city?: string;
  type?: string;
  coursesCount?: number;
}

/**
 * Generate description for a course
 */
export function getCourseDescriptionPrompt(course: CourseInfo): string {
  return `Você é um especialista em educação superior em Portugal.
Gere uma descrição informativa e profissional para o seguinte curso:

Nome: ${course.name}
${course.universityName ? `Universidade: ${course.universityName}` : ''}
${course.level ? `Nível: ${course.level}` : ''}
${course.area ? `Área: ${course.area}` : ''}
${course.subArea ? `Sub-área: ${course.subArea}` : ''}
${course.duration ? `Duração: ${course.duration}` : ''}
${course.modality ? `Modalidade: ${course.modality}` : ''}
${course.city ? `Cidade: ${course.city}` : ''}

A descrição deve ter 2-3 parágrafos e destacar:
- O que o curso oferece e seu foco principal
- Oportunidades de carreira e mercado de trabalho
- Diferenciais do programa

Escreva em português de Portugal. Seja profissional e informativo.
Responda APENAS com a descrição, sem formatação extra ou introdução.`;
}

/**
 * Generate description for a university
 */
export function getUniversityDescriptionPrompt(university: UniversityInfo): string {
  return `Você é um especialista em educação superior em Portugal.
Gere uma descrição informativa e profissional para a seguinte instituição de ensino:

Nome: ${university.name}
${university.shortName ? `Sigla: ${university.shortName}` : ''}
${university.city ? `Cidade: ${university.city}` : ''}
${university.type ? `Tipo: ${university.type}` : ''}
${university.coursesCount ? `Número de cursos: ${university.coursesCount}` : ''}

A descrição deve ter 2-3 parágrafos e destacar:
- História e reputação da instituição
- Principais áreas de ensino e investigação
- Infraestrutura e diferenciais

Escreva em português de Portugal. Seja profissional e informativo.
Responda APENAS com a descrição, sem formatação extra ou introdução.`;
}

/**
 * Parse natural language search query
 */
export function getSearchParsePrompt(query: string): string {
  return `Interprete a seguinte busca de curso universitário em Portugal:

Query: "${query}"

Extraia os seguintes campos (se presentes na query):
- level: O nível do curso (graduacao, licenciatura, mestrado, mestrado-integrado, doutorado, mba, pos-graduacao, curso-tecnico)
- area: Área de estudo mencionada
- city: Cidade em Portugal mencionada
- modality: Modalidade (presencial, online, hibrido, e-learning)
- schedule: Horário (diurno, noturno, pos-laboral)
- priceMax: Valor máximo mencionado em EUR (apenas o número)
- keywords: Palavras-chave adicionais para busca

IMPORTANTE:
- Se o campo não for mencionado, use null
- Normalize os valores para minúsculas sem acentos
- Para "level", mapeie termos como "mestrado em...", "licenciatura em...", "curso de..."
- Para "area", extraia a área de estudo (ex: "engenharia informática", "medicina", "direito")

Responda APENAS com JSON válido:
{
  "level": "mestrado" | null,
  "area": "string" | null,
  "city": "string" | null,
  "modality": "presencial" | "online" | "hibrido" | null,
  "schedule": "diurno" | "noturno" | "pos-laboral" | null,
  "priceMax": number | null,
  "keywords": ["array", "of", "keywords"]
}`;
}

/**
 * Generate search explanation
 */
export function getSearchExplanationPrompt(
  query: string,
  parsed: Record<string, unknown>,
  resultsCount: number
): string {
  return `Com base na busca do utilizador e nos resultados encontrados, gere uma breve explicação em português de Portugal.

Query original: "${query}"
Interpretação: ${JSON.stringify(parsed)}
Resultados encontrados: ${resultsCount}

Gere uma frase natural explicando o que foi entendido e quantos resultados foram encontrados.
Exemplo: "Encontrámos 15 mestrados na área de inteligência artificial em Lisboa."

Responda APENAS com a frase, sem formatação extra.`;
}

interface RecommendationProfile {
  interests: string[];
  currentEducation?: string;
  careerGoals?: string;
  preferences?: {
    city?: string;
    modality?: string;
    maxPrice?: number;
    level?: string;
  };
}

interface CourseForRecommendation {
  id: string;
  name: string;
  level: string;
  area?: string;
  subArea?: string;
  description?: string;
  city?: string;
  modality?: string;
  price?: string;
  universityName: string;
}

/**
 * Generate course recommendations
 */
export function getRecommendationPrompt(
  profile: RecommendationProfile,
  courses: CourseForRecommendation[]
): string {
  const coursesJson = courses.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    area: c.area,
    city: c.city,
    modality: c.modality,
    price: c.price,
    university: c.universityName,
  }));

  return `Você é um conselheiro educacional especializado em ensino superior em Portugal.
Analise o perfil do utilizador e recomende os cursos mais adequados da lista fornecida.

PERFIL DO UTILIZADOR:
Interesses: ${profile.interests.join(', ')}
${profile.currentEducation ? `Formação atual: ${profile.currentEducation}` : ''}
${profile.careerGoals ? `Objetivos de carreira: ${profile.careerGoals}` : ''}
${profile.preferences?.city ? `Cidade preferida: ${profile.preferences.city}` : ''}
${profile.preferences?.modality ? `Modalidade preferida: ${profile.preferences.modality}` : ''}
${profile.preferences?.level ? `Nível desejado: ${profile.preferences.level}` : ''}
${profile.preferences?.maxPrice ? `Orçamento máximo: ${profile.preferences.maxPrice}€` : ''}

CURSOS DISPONÍVEIS:
${JSON.stringify(coursesJson, null, 2)}

Para cada curso recomendado, forneça:
1. ID do curso
2. Score de compatibilidade (0-100)
3. Lista de razões para a recomendação (em português de Portugal)

Responda APENAS com JSON válido:
{
  "recommendations": [
    {
      "courseId": "id_do_curso",
      "matchScore": 85,
      "reasons": ["Razão 1", "Razão 2", "Razão 3"]
    }
  ],
  "summary": "Breve resumo das recomendações em português de Portugal"
}

Ordene por matchScore decrescente. Máximo 10 recomendações.`;
}

interface CourseForComparison {
  id: string;
  name: string;
  level: string;
  area?: string;
  description?: string;
  duration?: string;
  credits?: number;
  modality?: string;
  price?: string;
  city?: string;
  universityName: string;
  universityType?: string;
}

/**
 * Compare courses or universities
 */
export function getComparisonPrompt(items: CourseForComparison[]): string {
  const itemsJson = items.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    area: c.area,
    duration: c.duration,
    credits: c.credits,
    modality: c.modality,
    price: c.price,
    city: c.city,
    university: c.universityName,
    universityType: c.universityType,
  }));

  return `Você é um especialista em educação superior em Portugal.
Faça uma análise comparativa detalhada dos seguintes cursos:

CURSOS A COMPARAR:
${JSON.stringify(itemsJson, null, 2)}

Analise os cursos nos seguintes critérios:
1. Reputação/Prestígio da instituição
2. Custo-benefício
3. Localização e acessibilidade
4. Empregabilidade e oportunidades de carreira
5. Estrutura do curso (duração, créditos, modalidade)

Para cada critério, explique as diferenças e faça um ranking.

Responda APENAS com JSON válido:
{
  "summary": "Resumo geral da comparação em 2-3 frases",
  "criteria": [
    {
      "name": "Nome do critério",
      "analysis": "Análise detalhada em português de Portugal",
      "ranking": ["id_primeiro", "id_segundo", "id_terceiro"]
    }
  ],
  "recommendation": "Recomendação final baseada na análise, indicando para que tipo de perfil cada curso é mais adequado"
}`;
}

/**
 * Extract data from webpage content
 */
export function getDataExtractionPrompt(
  pageContent: string,
  entityType: 'course' | 'university'
): string {
  if (entityType === 'course') {
    return `Você é um especialista em extrair informações de páginas web de cursos universitários.
Analise o seguinte conteúdo de página e extraia informações sobre o curso.

CONTEÚDO DA PÁGINA:
${pageContent.slice(0, 8000)}

Extraia as seguintes informações (se disponíveis):
- credits: Número de créditos ECTS
- duration: Duração do curso (ex: "2 anos", "4 semestres")
- durationMonths: Duração em meses (número)
- price: Valor das propinas (inclua o valor e período, ex: "1500€/ano")
- applicationDeadline: Prazo de candidatura (datas ou período)
- startDate: Data de início
- requirements: Requisitos de entrada
- language: Idioma(s) do curso
- applicationUrl: URL para candidatura online (se encontrado)
- documents: Lista de documentos importantes encontrados (PDFs, regulamentos, etc)

Responda APENAS com JSON válido:
{
  "credits": number | null,
  "duration": "string" | null,
  "durationMonths": number | null,
  "price": "string" | null,
  "applicationDeadline": "string" | null,
  "startDate": "string" | null,
  "requirements": "string" | null,
  "language": "string" | null,
  "applicationUrl": "string" | null,
  "documents": [
    {"name": "Nome do documento", "url": "URL completa", "type": "pdf|form|info"}
  ] | null,
  "confidence": 0.0-1.0
}

O campo "confidence" indica a confiança geral na extração (0.0 = baixa, 1.0 = alta).`;
  }

  return `Você é um especialista em extrair informações de páginas web de universidades.
Analise o seguinte conteúdo de página e extraia informações sobre a instituição.

CONTEÚDO DA PÁGINA:
${pageContent.slice(0, 8000)}

Extraia as seguintes informações (se disponíveis):
- description: Descrição/sobre a instituição
- address: Endereço completo
- email: Email de contato
- phone: Telefone de contato
- type: Tipo (publica, privada, politecnico)
- documents: Lista de documentos importantes encontrados (PDFs, regulamentos, calendários, etc)

Responda APENAS com JSON válido:
{
  "description": "string" | null,
  "address": "string" | null,
  "email": "string" | null,
  "phone": "string" | null,
  "type": "publica" | "privada" | "politecnico" | null,
  "documents": [
    {"name": "Nome do documento", "url": "URL completa", "type": "pdf|calendar|info"}
  ] | null,
  "confidence": 0.0-1.0
}

O campo "confidence" indica a confiança geral na extração (0.0 = baixa, 1.0 = alta).`;
}
