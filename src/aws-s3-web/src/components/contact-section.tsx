"use client";

import { FormEvent, useState } from "react";
import { Code2, Mail, Send } from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";
import {
  type ContactErrors,
  type ContactValues,
  validateContact,
} from "@/lib/contact-validation";

const initialValues: ContactValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

export function ContactSection() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (field: keyof ContactValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccess(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateContact(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      setSuccess(true);
      setValues(initialValues);
    }, 500);
  };

  return (
    <section className="page-section contact-section" id="contact" aria-labelledby="contact-heading">
      <div id="contact-heading"><SectionHeading prefix="$" title="./contact.exe" icon={sectionIcons.contact} /></div>
      <div className="contact-layout">
        <article className="contact-json reveal">
          <header className="window-titlebar">
            <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
            <div className="window-file"><Code2 aria-hidden="true" size={13} /> contact_info.json</div>
            <span className="window-spacer" />
          </header>
          <div className="json-body">
            <ol aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <li key={index}>{index + 1}</li>)}</ol>
            <div>
              <p><span className="json-yellow">{"{"}</span></p>
              <p className="indent-one"><span className="json-key">&quot;status&quot;</span>: <span className="json-green">&quot;sample_available&quot;</span>,</p>
              <p className="indent-one"><span className="json-key">&quot;email&quot;</span>: <a href={"mailto:" + portfolio.identity.email}>&quot;{portfolio.identity.email}&quot;</a>,</p>
              <p className="indent-one"><span className="json-key">&quot;socials&quot;</span>: <span className="json-yellow">{"{"}</span></p>
              {portfolio.socials.map((social, index) => (
                <p className="indent-two" key={social.label}>
                  <span className="json-key">&quot;{social.label.toLowerCase()}&quot;</span>: <a href={social.href} target="_blank" rel="noreferrer">&quot;{social.value}&quot;</a>{index < portfolio.socials.length - 1 ? "," : ""}
                </p>
              ))}
              <p className="indent-one"><span className="json-yellow">{"}"}</span>,</p>
              <p className="indent-one"><span className="json-key">&quot;location&quot;</span>: <span className="json-orange">&quot;{portfolio.identity.location}&quot;</span></p>
              <p><span className="json-yellow">{"}"}</span></p>
              <p className="json-comment">{"// Waiting for a local demo connection..."}</p>
              <p className="json-caret">_</p>
            </div>
          </div>
        </article>
        <article className="contact-editor reveal">
          <header><span>TS</span> sendMessage.ts <i aria-hidden="true">×</i></header>
          <form onSubmit={submit} noValidate>
            <div className="compose-bar"><span><Mail aria-hidden="true" size={14} /> mail.compose</span><small>local demo</small></div>
            <div className="compose-meta"><span>to: <strong>{portfolio.identity.email}</strong></span><span>response: <strong>simulated</strong></span></div>
            <div className="form-grid">
              <label>
                <span>Name</span>
                <input
                  name="name"
                  aria-label="Name"
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name ? <small className="field-error" id="name-error" role="alert">{errors.name}</small> : null}
              </label>
              <label>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  aria-label="Email"
                  value={values.email}
                  onChange={(event) => update("email", event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email ? <small className="field-error" id="email-error" role="alert">{errors.email}</small> : null}
              </label>
              <label className="form-wide">
                <span>Subject</span>
                <input
                  name="subject"
                  aria-label="Subject"
                  value={values.subject}
                  onChange={(event) => update("subject", event.target.value)}
                  placeholder="Sample project inquiry"
                />
              </label>
              <label className="form-wide">
                <span>Message</span>
                <textarea
                  name="message"
                  aria-label="Message"
                  rows={5}
                  value={values.message}
                  onChange={(event) => update("message", event.target.value)}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "message-error" : undefined}
                />
                {errors.message ? <small className="field-error" id="message-error" role="alert">{errors.message}</small> : null}
              </label>
            </div>
            <p className="form-note">{"// Front-end demonstration only. Nothing is transmitted."}</p>
            <div className="form-feedback" aria-live="polite">
              {success ? "Demo message accepted locally. No data was sent." : ""}
            </div>
            <button className="terminal-button terminal-button-primary submit-button" type="submit" disabled={pending}>
              <Send aria-hidden="true" size={15} /> {pending ? "Processing..." : "Send demo message"}
            </button>
          </form>
        </article>
      </div>
      <footer className="site-footer">
        <p><Code2 aria-hidden="true" size={18} /> Sample Developer <span>|</span> Platform Engineer</p>
        <small>Built as an original Next.js, TypeScript, and Three.js demonstration.</small>
        <small>© {new Date().getFullYear()} Sample Portfolio. Replace with your details.</small>
      </footer>
    </section>
  );
}
