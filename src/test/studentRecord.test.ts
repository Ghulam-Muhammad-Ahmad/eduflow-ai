import { describe, expect, it } from "vitest";

import { computeStudentRecordAverages } from "@/lib/studentRecord";

describe("computeStudentRecordAverages", () => {
  it("returns all nulls when there is nothing graded", () => {
    const result = computeStudentRecordAverages([], []);
    expect(result).toEqual({
      assignmentAvg: null,
      quizAvg: null,
      overallAvg: null,
      gradedQuizzesCount: 0,
    });
  });

  it("averages assignment grades as a percentage of points possible", () => {
    const result = computeStudentRecordAverages(
      [
        { grade: 80, points_possible: 100 },
        { grade: 18, points_possible: 20 }, // 90%
        { grade: null, points_possible: 100 }, // ungraded, excluded
      ],
      []
    );
    expect(result.assignmentAvg).toBeCloseTo(85);
    expect(result.quizAvg).toBeNull();
    expect(result.overallAvg).toBeCloseTo(85);
  });

  it("takes the best score per quiz, not an average of attempts", () => {
    const result = computeStudentRecordAverages(
      [],
      [
        { quiz_id: "q1", score: 40, points_earned: null, points_possible: null },
        { quiz_id: "q1", score: 90, points_earned: null, points_possible: null }, // best
        { quiz_id: "q2", score: null, points_earned: 8, points_possible: 10 }, // 80%
      ]
    );
    expect(result.gradedQuizzesCount).toBe(2);
    expect(result.quizAvg).toBeCloseTo((90 + 80) / 2);
  });

  it("excludes quiz attempts with no usable score from the graded count", () => {
    const result = computeStudentRecordAverages(
      [],
      [{ quiz_id: "q1", score: null, points_earned: null, points_possible: null }]
    );
    expect(result.gradedQuizzesCount).toBe(0);
    expect(result.quizAvg).toBeNull();
  });

  it("blends assignment and quiz averages weighted by graded count", () => {
    const result = computeStudentRecordAverages(
      [
        { grade: 100, points_possible: 100 },
        { grade: 100, points_possible: 100 },
        { grade: 100, points_possible: 100 }, // 3 assignments at 100%
      ],
      [{ quiz_id: "q1", score: 0, points_earned: null, points_possible: null }] // 1 quiz at 0%
    );
    // (100*3 + 0*1) / 4 = 75
    expect(result.overallAvg).toBeCloseTo(75);
  });
});
