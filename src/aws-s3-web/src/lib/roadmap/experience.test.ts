import { describe, expect, it } from "vitest";

import {
  IMPORTANCE_LABELS,
  LEGEND_ENTRIES,
  MY_LEVEL_LABELS,
  allSubtopics,
  allTopics,
  findStage,
  findSubtopic,
  findTopic,
  stageCoverage,
  topicCoverage,
  totalCoverage,
} from "@/lib/roadmap/experience";
import type { MyLevel, RoadmapStage, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

function subtopic(id: string, myLevel: MyLevel): RoadmapSubtopic {
  return { id, title: id, importance: "core", note: "n", myLevel };
}

function topic(id: string, subtopics: RoadmapSubtopic[], myLevel: MyLevel = "none"): RoadmapTopic {
  return {
    id,
    title: id,
    importance: "core",
    summary: "s",
    why: "w",
    resources: [{ label: "r", url: "https://example.com/" }],
    myLevel,
    subtopics,
  };
}

function stage(id: string, topics: RoadmapTopic[]): RoadmapStage {
  return {
    id,
    index: 0,
    label: id,
    kicker: "STAGE 00",
    outcome: "o",
    accent: "blue",
    topics,
  };
}

describe("topicCoverage", () => {
  it("counts production and working as practised, learning and none as not", () => {
    const result = topicCoverage(
      topic("t", [
        subtopic("a", "production"),
        subtopic("b", "working"),
        subtopic("c", "learning"),
        subtopic("d", "none"),
      ]),
    );
    expect(result).toEqual({ practised: 2, total: 4, percent: 50 });
  });

  it("reports 0 percent for a topic with no subtopics instead of dividing by zero", () => {
    expect(topicCoverage(topic("t", []))).toEqual({ practised: 0, total: 0, percent: 0 });
  });

  it("rounds the percentage to a whole number", () => {
    const result = topicCoverage(
      topic("t", [subtopic("a", "production"), subtopic("b", "none"), subtopic("c", "none")]),
    );
    expect(result.percent).toBe(33);
  });

  it("ignores the topic's own level, which is reported separately", () => {
    const result = topicCoverage(topic("t", [subtopic("a", "none")], "production"));
    expect(result.practised).toBe(0);
  });
});

describe("stageCoverage and totalCoverage", () => {
  const first = stage("one", [
    topic("t1", [subtopic("a", "production"), subtopic("b", "none")]),
    topic("t2", [subtopic("c", "working")]),
  ]);
  const second = stage("two", [topic("t3", [subtopic("d", "learning")])]);

  it("aggregates every subtopic in a stage", () => {
    expect(stageCoverage(first)).toEqual({ practised: 2, total: 3, percent: 67 });
  });

  it("aggregates every subtopic across all stages", () => {
    expect(totalCoverage([first, second])).toEqual({ practised: 2, total: 4, percent: 50 });
  });

  it("reports 0 percent for an empty stage", () => {
    expect(stageCoverage(stage("empty", []))).toEqual({ practised: 0, total: 0, percent: 0 });
  });
});

describe("lookups", () => {
  const stages = [
    stage("alpha", [topic("t1", [subtopic("leaf", "production")])]),
    stage("beta", [topic("t2", [])]),
  ];

  it("flattens topics and subtopics", () => {
    expect(allTopics(stages).map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(allSubtopics(stages).map((s) => s.id)).toEqual(["leaf"]);
  });

  it("finds a stage, a topic, and a subtopic by id", () => {
    expect(findStage(stages, "beta")?.id).toBe("beta");
    expect(findTopic(stages, "t1")?.id).toBe("t1");
    expect(findSubtopic(stages, "leaf")?.subtopic.id).toBe("leaf");
  });

  it("returns the parent topic alongside a found subtopic", () => {
    expect(findSubtopic(stages, "leaf")?.topic.id).toBe("t1");
  });

  it("returns undefined for unknown ids", () => {
    expect(findStage(stages, "nope")).toBeUndefined();
    expect(findTopic(stages, "nope")).toBeUndefined();
    expect(findSubtopic(stages, "nope")).toBeUndefined();
  });
});

describe("label maps", () => {
  it("labels every experience level", () => {
    (["production", "working", "learning", "none"] as MyLevel[]).forEach((level) => {
      expect(MY_LEVEL_LABELS[level]).toBeTruthy();
    });
  });

  it("labels every importance level", () => {
    expect(IMPORTANCE_LABELS.core).toBeTruthy();
    expect(IMPORTANCE_LABELS.recommended).toBeTruthy();
    expect(IMPORTANCE_LABELS.optional).toBeTruthy();
  });

  it("has one legend entry per importance level", () => {
    expect(LEGEND_ENTRIES.map((entry) => entry.importance)).toEqual([
      "core",
      "recommended",
      "optional",
    ]);
    LEGEND_ENTRIES.forEach((entry) => {
      expect(entry.label.length).toBeGreaterThan(0);
      // Colour comes from the --rm-* tokens via data-importance, so an entry
      // carrying its own would silently outrank the theme.
      expect(entry).not.toHaveProperty("color");
    });
  });
});
