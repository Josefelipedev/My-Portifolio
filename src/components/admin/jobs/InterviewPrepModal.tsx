'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

interface StarStory {
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface TechnicalTopic {
  topic: string;
  relevance: string;
  tip: string;
}

interface SalaryScript {
  opening: string;
  anchor: string;
  justification: string;
  flexibility: string;
}

export interface InterviewPrep {
  starStories: StarStory[];
  technicalTopics: TechnicalTopic[];
  salaryScript: SalaryScript;
  keyQuestions: string[];
}

interface InterviewPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  prep: InterviewPrep;
  jobTitle: string;
  company: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copiado!
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copiar
        </>
      )}
    </button>
  );
}

function StarStoryCard({ story, index }: { story: StarStory; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  const fullText = `Q: ${story.question}\n\nS (Situation): ${story.situation}\n\nT (Task): ${story.task}\n\nA (Action): ${story.action}\n\nR (Result): ${story.result}`;

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 pr-4">{story.question}</span>
        <svg
          className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="p-3 space-y-2">
          {(['situation', 'task', 'action', 'result'] as const).map((key) => (
            <div key={key} className="flex gap-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase w-16 flex-shrink-0 mt-0.5">
                {key[0].toUpperCase()}
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{story[key]}</p>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <CopyButton text={fullText} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewPrepModal({ isOpen, onClose, prep, jobTitle, company }: InterviewPrepModalProps) {
  const [activeTab, setActiveTab] = useState<'star' | 'technical' | 'salary' | 'questions'>('star');

  const salaryFullText = `Opening: ${prep.salaryScript.opening}\n\nAnchor: ${prep.salaryScript.anchor}\n\nJustification: ${prep.salaryScript.justification}\n\nFlexibility: ${prep.salaryScript.flexibility}`;

  const tabs = [
    { key: 'star' as const, label: 'STAR Stories', count: prep.starStories.length },
    { key: 'technical' as const, label: 'Técnico', count: prep.technicalTopics.length },
    { key: 'salary' as const, label: 'Salário', count: null },
    { key: 'questions' as const, label: 'Perguntas', count: prep.keyQuestions.length },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" title={`Prep para Entrevista — ${jobTitle} @ ${company}`}>
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 mb-4 -mt-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-700 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* STAR Stories */}
      {activeTab === 'star' && (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Histórias no formato STAR baseadas na sua experiência, adaptadas para esta vaga. Clique para expandir.
          </p>
          {prep.starStories.map((story, i) => (
            <StarStoryCard key={i} story={story} index={i} />
          ))}
        </div>
      )}

      {/* Technical Topics */}
      {activeTab === 'technical' && (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Tópicos técnicos prováveis com base na descrição da vaga.
          </p>
          {prep.technicalTopics.map((topic, i) => (
            <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{topic.topic}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{topic.relevance}</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Dica:</span> {topic.tip}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Salary Script */}
      {activeTab === 'salary' && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Script de negociação salarial para este cargo e localização.
            </p>
            <CopyButton text={salaryFullText} />
          </div>
          {(
            [
              { label: 'Abertura', key: 'opening' as const, color: 'blue' },
              { label: 'Âncora de Salário', key: 'anchor' as const, color: 'green' },
              { label: 'Justificativa', key: 'justification' as const, color: 'purple' },
              { label: 'Flexibilidade', key: 'flexibility' as const, color: 'zinc' },
            ] as const
          ).map(({ label, key, color }) => (
            <div key={key} className={`bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800 rounded-lg p-3`}>
              <p className={`text-xs font-semibold text-${color}-700 dark:text-${color}-300 mb-2`}>{label}</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">&ldquo;{prep.salaryScript[key]}&rdquo;</p>
            </div>
          ))}
        </div>
      )}

      {/* Key Questions */}
      {activeTab === 'questions' && (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Perguntas inteligentes para fazer ao entrevistador — demonstram interesse e pesquisa.
          </p>
          {prep.keyQuestions.map((question, i) => (
            <div key={i} className="flex items-start justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{question}</p>
              <CopyButton text={question} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
