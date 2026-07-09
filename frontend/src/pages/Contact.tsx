import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { Field, TextArea } from "../components/forms";
import { PageHero } from "../components/PageHero";

export function Contact() {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setStatus("Sending...");
    try {
      await api.createSupportTicket({
        subject: form.get("subject"),
        email: form.get("email"),
        phone: form.get("phone"),
        category: "storefront",
        message: form.get("message"),
      });
      formEl.reset();
      setStatus("Message sent. Admin can reply from support tickets.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not send message.");
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the store team."
        copy="This form creates a support ticket in the Django backend, so admin can reply and keep the conversation attached to your account."
      />
      <section className="contact-layout">
        <form className="panel-form" onSubmit={submit}>
          <Field label="Email" name="email" type="email" required />
          <Field label="Phone" name="phone" />
          <Field label="Subject" name="subject" required />
          <TextArea label="Message" name="message" rows={6} required />
          <button className="button primary" type="submit">
            Send message
          </button>
          {status ? <p className="inline-status">{status}</p> : null}
        </form>
        <aside className="contact-card">
          <p className="eyebrow">Support information</p>
          <h2>We route customer questions directly to admin.</h2>
          <p>Email: support@nawamu.test</p>
          <p>Phone: +254 700 000 000</p>
          <p>Hours: Monday to Saturday, 8:00-18:00</p>
        </aside>
      </section>
      <section className="section faq-list">
        {faqs.map((faq) => (
          <article key={faq.question}>
            <h3>{faq.question}</h3>
            <p>{faq.answer}</p>
          </article>
        ))}
      </section>
    </>
  );
}

const faqs = [
  { question: "Can I track my order?", answer: "Yes. Login, open account orders, and view the timeline from the backend." },
  { question: "How do payments work?", answer: "Checkout creates an M-Pesa payment request and waits for the Daraja callback." },
  { question: "Can admin reply to support?", answer: "Yes. Tickets and messages are available in Django Admin and the API." },
];
