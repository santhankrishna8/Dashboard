import { z } from "zod";
import { Card } from "../ui/Card";
import { usePeek } from "../lib/feed";
import { host } from "../lib/fmt";

const News = z.object({ items: z.array(z.object({ title: z.string(), url: z.string(), tag: z.string(), score: z.number().optional() })) });
const Repos = z.array(z.object({ full_name: z.string(), html_url: z.string(), description: z.string().nullish(), stargazers_count: z.number() }));
const Lesson = z.object({ title: z.string(), body: z.string() });
const Ideas = z.array(z.object({ title: z.string(), pitch: z.string() }));
const Services = z.array(z.object({ name: z.string(), level: z.string(), text: z.string() }));
const Wx = z.object({ place: z.string(), current: z.object({ temperature_2m: z.number() }), air: z.object({ us_aqi: z.number().nullish() }).nullish() });

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const firstSentence = (s: string) => s.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? s;

/** Everything worth a glance today, assembled from what the other cards have already loaded. Costs no requests. */
export function BriefWidget() {
  const news = News.safeParse(usePeek("news"));
  const repos = Repos.safeParse(usePeek("repos"));
  const lesson = Lesson.safeParse(usePeek("lesson"));
  const ideas = Ideas.safeParse(usePeek("ideas"));
  const services = Services.safeParse(usePeek("status"));
  const wx = Wx.safeParse(usePeek("weather"));

  const parts: string[] = [];
  if (wx.success) {
    const aqi = wx.data.air?.us_aqi;
    parts.push(`${Math.round(wx.data.current.temperature_2m)}° in ${wx.data.place.split(",")[0]}${typeof aqi === "number" ? `, air quality ${Math.round(aqi)}` : ""}`);
  }
  if (services.success) {
    const bad = services.data.filter((x) => x.level === "minor" || x.level === "major");
    parts.push(bad.length === 0 ? "dev services all operational" : bad.map((x) => `${x.name} reports ${x.text.toLowerCase()}`).join(", "));
  }

  const top = news.success ? news.data.items.slice(0, 3) : [];
  const repo = repos.success ? repos.data[0] : undefined;
  const idea = ideas.success ? ideas.data[0] : undefined;

  return (
    <Card title="Today's brief" meta={new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}>
      <div className="brief">
        <header className="brief-head">
          <h3>{greeting()}.</h3>
          <p>{parts.length > 0 ? `${parts.join(". ")}.` : "Your feeds are still loading."}</p>
        </header>

        <section>
          <h4>Top stories</h4>
          {top.length > 0 ? (
            <ol className="brief-list">
              {top.map((n) => (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
                  <span className="muted">{n.tag} · {host(n.url)}{n.score !== undefined ? ` · fit ${Math.round(n.score * 100)}` : ""}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Loading the news.</p>
          )}
        </section>

        {lesson.success ? (
          <section>
            <h4>Learn</h4>
            <p className="brief-lead">{lesson.data.title}</p>
            <p className="muted">{firstSentence(lesson.data.body)} <a href="#build">Take the quiz on the Build desk.</a></p>
          </section>
        ) : null}

        {repo || idea ? (
          <section>
            <h4>Try</h4>
            {repo ? (
              <p>
                <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="brief-lead">{repo.full_name}</a>
                <span className="muted"> — {repo.description ?? "a new repo gaining stars"}</span>
              </p>
            ) : null}
            {idea ? <p><span className="brief-lead">{idea.title}.</span> <span className="muted">{firstSentence(idea.pitch)}</span></p> : null}
          </section>
        ) : null}
      </div>
    </Card>
  );
}
