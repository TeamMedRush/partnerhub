import type { AuthSession, User } from "@interfaces/app";

interface AboutProps {
  session: AuthSession<User> | null;
}

const pillars = [
  {
    title: "Keep stock live",
    description: "Use the existing partner inventory endpoint to keep price and quantity synced without introducing a separate backend contract.",
  },
  {
    title: "Enrich locally, ship safely",
    description: "Brand, category, expiry, and prescription flags are stored as local UI metadata until medicine management APIs arrive.",
  },
  {
    title: "Flag backend gaps clearly",
    description: "The orders route stays honest about missing partner queue endpoints instead of pretending a fulfillment flow exists already.",
  },
];

export function About({ session }: AboutProps) {
  return (
    <section className="about">
      <div className="about__hero">
        <div className="about__copy">
          <p className="about__eyebrow">Pharmacy partner workspace</p>
          <h2>Run inventory, pricing, and readiness from one MedRush partner console.</h2>
          <p className="about__summary">
            Partner Hub is shaped around the current backend contract: live auth, live inventory write-back,
            local catalog enrichment, and graceful messaging where order queue support is still missing.
          </p>
        </div>

        <div className="about__actions">
          <a className="about__button about__button--primary" href={session ? "/dashboard" : "/login"}>
            {session ? "Open dashboard" : "Sign in"}
          </a>
          <a className="about__button about__button--secondary" href={session ? "/inventory" : "/register"}>
            {session ? "Manage inventory" : "Register pharmacy"}
          </a>
        </div>
      </div>

      <div className="about__grid">
        {pillars.map((pillar) => (
          <article className="about__card" key={pillar.title}>
            <h3>{pillar.title}</h3>
            <p>{pillar.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

