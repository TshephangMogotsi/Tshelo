import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from 'lucide-react'

export type PolicySection = {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

type PolicyDocumentProps = {
  title: string
  highlightedTitle: string
  summary: string
  introduction: string
  sections: PolicySection[]
  relatedHref: Route
  relatedLabel: string
}

export function PolicyDocument({
  title,
  highlightedTitle,
  summary,
  introduction,
  sections,
  relatedHref,
  relatedLabel,
}: PolicyDocumentProps) {
  return (
    <section className="member-policy-page">
      <Link className="member-policy-back" href={'/account/preferences' as Route}>
        <ArrowLeft size={15} /> Account preferences
      </Link>

      <header className="member-policy-hero">
        <span className="member-policy-eyebrow"><ShieldCheck size={14} /> Privacy &amp; consent</span>
        <h1>{title} <em>{highlightedTitle}</em></h1>
        <p>{summary}</p>
        <dl className="member-policy-meta">
          <div><dt>Version</dt><dd>1.0</dd></div>
          <div><dt>Effective date</dt><dd>27 August 2026</dd></div>
          <div><dt>Contact</dt><dd><a href="mailto:support@tshelo.co.bw">support@tshelo.co.bw</a></dd></div>
        </dl>
      </header>

      <div className="member-policy-layout">
        <nav className="member-policy-toc" aria-label={`${title} ${highlightedTitle} contents`}>
          <strong>On this page</strong>
          <ol>
            {sections.map((section, index) => (
              <li key={section.id}><a href={`#${section.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</a></li>
            ))}
          </ol>
        </nav>

        <article className="member-policy-document">
          <p className="member-policy-introduction">{introduction}</p>

          {sections.map((section, index) => (
            <section id={section.id} key={section.id} className="member-policy-section">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{section.title}</h2>
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && (
                  <ul>
                    {section.bullets.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}

          <footer className="member-policy-footer">
            <div>
              <Mail size={18} />
              <p><strong>Questions about your data?</strong> Contact <a href="mailto:support@tshelo.co.bw">support@tshelo.co.bw</a>.</p>
            </div>
            <Link href={relatedHref}>Read {relatedLabel} <ArrowRight size={14} /></Link>
          </footer>
        </article>
      </div>
    </section>
  )
}
