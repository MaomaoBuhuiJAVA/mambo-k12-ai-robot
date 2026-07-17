import { BadgeCheck, ExternalLink } from "lucide-react";

import { getKnowledgeContextForCourse } from "@/data/knowledge-sources";

import styles from "./knowledge-evidence.module.css";

interface KnowledgeEvidenceProps {
  courseId: string;
  variant: "facts" | "sources";
}

export function KnowledgeEvidence({ courseId, variant }: KnowledgeEvidenceProps) {
  const context = getKnowledgeContextForCourse(courseId);
  if (!context) return null;
  const sourceNumberById = new Map(
    context.sources.map((source, index) => [source.id, index + 1]),
  );

  return (
    <section className={styles.evidence} data-variant={variant}>
      <h3>
        <BadgeCheck size={16} aria-hidden="true" />
        {variant === "facts" ? "事实依据" : "权威参考"}
      </h3>
      {variant === "facts" ? (
        <ul className={styles.facts}>
          {context.facts.map((fact) => (
            <li key={fact.id}>
              <span>{fact.statement}</span>
              {fact.sourceIds.map((sourceId) => (
                <span className={styles.citation} key={sourceId}>
                  [{sourceNumberById.get(sourceId)}]
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p>以下链接来自标准机构或项目官方文档，不替代教材版本。</p>
      )}
      <ul className={styles.sources} aria-label={`${context.topic.label}来源`}>
        {context.sources.map((source, index) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              <span><b className={styles.citation}>[{index + 1}]</b> {source.publisher}</span>
              <small>{source.title}</small>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
