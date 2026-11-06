export type ActivityKind = 'would-you-rather' | 'this-or-that' | 'question-of-the-day'

export const activityLabel: Record<ActivityKind, string> = {
  'would-you-rather': 'Would you rather',
  'this-or-that': 'This or that',
  'question-of-the-day': 'Question of the day',
}
