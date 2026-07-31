import { describe, expect, it } from "vitest";

import { portfolio } from "@/data/portfolio";
import { roadmapStages } from "@/data/roadmap";
import { allSubtopics, allTopics } from "@/lib/roadmap/experience";
import type { MyLevel, NodeImportance, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

const IMPORTANCE: NodeImportance[] = ["core", "recommended", "optional"];
const LEVELS: MyLevel[] = ["production", "working", "learning", "none"];

const topics = allTopics(roadmapStages);
const subtopics = allSubtopics(roadmapStages);

type Labelled = { id: string; title: string; myLevel: MyLevel };

// A skill claimed on the portfolio must not be marked unpractised on the
// roadmap. Matches on a whole-word title match, so "Git" does not spuriously
// match "GitHub Actions".
function driftViolations(
  skills: readonly { label: string }[],
  entries: readonly Labelled[],
): string[] {
  const violations: string[] = [];

  skills.forEach((skill) => {
    const escaped = skill.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titlePattern = new RegExp(`\\b${escaped}\\b`, "i");

    entries.forEach((entry) => {
      if (titlePattern.test(entry.title) && entry.myLevel === "none") {
        violations.push(`${skill.label} -> ${entry.id}`);
      }
    });
  });

  return violations;
}

describe("roadmap stages", () => {
  it("has four stages with contiguous, ordered indexes", () => {
    expect(roadmapStages).toHaveLength(4);
    expect(roadmapStages.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it("has unique, url-safe stage ids", () => {
    const ids = roadmapStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it("gives every stage a label, kicker, outcome, and at least one topic", () => {
    roadmapStages.forEach((stage) => {
      expect(stage.label.length).toBeGreaterThan(0);
      expect(stage.kicker.length).toBeGreaterThan(0);
      expect(stage.outcome.length).toBeGreaterThan(0);
      expect(stage.topics.length, stage.id).toBeGreaterThan(0);
    });
  });

  it("includes exactly one AI-accented stage", () => {
    expect(roadmapStages.filter((s) => s.accent === "ai")).toHaveLength(1);
  });
});

describe("roadmap topics", () => {
  it("carries enough depth to read as a full roadmap", () => {
    expect(topics.length).toBeGreaterThanOrEqual(20);
    expect(subtopics.length).toBeGreaterThanOrEqual(100);
  });

  it("has unique, url-safe ids across topics and subtopics alike", () => {
    const ids = [...topics, ...subtopics].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it("gives every topic a title, summary, why, and at least two subtopics", () => {
    topics.forEach((topic) => {
      expect(topic.title.length, topic.id).toBeGreaterThan(0);
      expect(topic.summary.length, topic.id).toBeGreaterThan(0);
      expect(topic.why.length, topic.id).toBeGreaterThan(0);
      expect(topic.subtopics.length, topic.id).toBeGreaterThanOrEqual(2);
    });
  });

  it("gives every topic at least one absolute https resource", () => {
    topics.forEach((topic) => {
      expect(topic.resources.length, topic.id).toBeGreaterThan(0);
      topic.resources.forEach((resource) => {
        expect(resource.label.length, topic.id).toBeGreaterThan(0);
        expect(resource.url, topic.id).toMatch(/^https:\/\//);
        expect(() => new URL(resource.url), topic.id).not.toThrow();
      });
    });
  });

  it("gives every subtopic a title and a note", () => {
    subtopics.forEach((subtopic) => {
      expect(subtopic.title.length, subtopic.id).toBeGreaterThan(0);
      expect(subtopic.note.length, subtopic.id).toBeGreaterThan(0);
    });
  });

  it("uses only known importance and experience values", () => {
    [...topics, ...subtopics].forEach((entry) => {
      expect(IMPORTANCE, entry.id).toContain(entry.importance);
      expect(LEVELS, entry.id).toContain(entry.myLevel);
    });
  });

  it("backs every production-level topic with at least one production subtopic", () => {
    // Otherwise the overlay overstates the case at the topic level.
    topics
      .filter((topic) => topic.myLevel === "production")
      .forEach((topic) => {
        const practised = topic.subtopics.filter((s) => s.myLevel === "production").length;
        expect(practised, topic.id).toBeGreaterThan(0);
      });
  });
});

describe("portfolio drift", () => {
  it("never marks a claimed portfolio skill as myLevel 'none'", () => {
    expect(driftViolations(portfolio.skills, [...topics, ...subtopics])).toEqual([]);
  });

  it("covers every portfolio skill somewhere on the roadmap", () => {
    const titles = [...topics, ...subtopics].map((entry) => entry.title);
    const missing = portfolio.skills.filter((skill) => {
      const escaped = skill.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escaped}\\b`, "i");
      return !titles.some((title) => pattern.test(title));
    });
    expect(missing.map((skill) => skill.label)).toEqual([]);
  });

  it("detects a title match", () => {
    const entry: Labelled = { id: "synthetic", title: "Kubernetes", myLevel: "none" };
    expect(driftViolations([{ label: "Kubernetes" }], [entry])).toEqual([
      "Kubernetes -> synthetic",
    ]);
  });

  it("respects whole-word title boundaries", () => {
    const entry: Labelled = { id: "synthetic", title: "GitHub Actions", myLevel: "none" };
    expect(driftViolations([{ label: "Git" }], [entry])).toEqual([]);
  });

  it("ignores practised entries", () => {
    const entry: Labelled = { id: "synthetic", title: "Kubernetes", myLevel: "production" };
    expect(driftViolations([{ label: "Kubernetes" }], [entry])).toEqual([]);
  });
});

describe("type shape", () => {
  it("keeps topics and subtopics structurally distinct", () => {
    const topic: RoadmapTopic = topics[0];
    const subtopic: RoadmapSubtopic = subtopics[0];
    expect(topic).toHaveProperty("subtopics");
    expect(subtopic).not.toHaveProperty("subtopics");
    expect(subtopic).toHaveProperty("note");
  });
});
