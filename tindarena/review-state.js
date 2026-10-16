export const CHOICES = Object.freeze(['before', 'after', 'neither', 'tie']);

export class ReviewState {
  constructor(dataset, saved = null) {
    if (!dataset?.id || !Array.isArray(dataset.fighters) || !Array.isArray(dataset.hats)
      || !dataset.fighters.length || !dataset.hats.length
      || dataset.fighters.some(id => !/^-\d+$/.test(id)) || dataset.hats.some(id => !/^\d+$/.test(id))
      || new Set(dataset.fighters).size !== dataset.fighters.length || new Set(dataset.hats).size !== dataset.hats.length) {
      throw new Error('Invalid comparison dataset.');
    }
    this.dataset = dataset;
    this.cases = dataset.fighters.flatMap(fighter => dataset.hats.map((hat, hatIndex) => ({
      id: `${fighter}/${hat}`, fighter, hat, pairIndex: dataset.nativePairs + hatIndex,
      sheet: `images/${fighter}.png`,
    })));
    this.index = 0;
    this.answers = {};
    this.drafts = {};
    this.screen = 'review';
    this.editMode = false;
    this.completedAt = null;
    if (saved?.datasetId === dataset.id && saved?.version === 1) {
      const valid = value => value && CHOICES.includes(value.choice) && typeof value.comment === 'string' && value.comment.length <= 2000;
      for (const item of this.cases) {
        if (valid(saved.answers?.[item.id])) this.answers[item.id] = { ...saved.answers[item.id] };
        const draft = saved.drafts?.[item.id];
        if (draft && (draft.choice === null || CHOICES.includes(draft.choice)) && typeof draft.comment === 'string' && draft.comment.length <= 2000) {
          this.drafts[item.id] = { choice: draft.choice, comment: draft.comment };
        }
      }
      if (Number.isInteger(saved.index) && saved.index >= 0 && saved.index < this.cases.length) this.index = saved.index;
      if (saved.screen === 'complete' && this.count === this.cases.length) this.screen = 'complete';
      this.editMode = saved.editMode === true;
      this.completedAt = typeof saved.completedAt === 'string' ? saved.completedAt : null;
    }
  }
  get current() { return this.cases[this.index]; }
  get count() { return Object.keys(this.answers).length; }
  get draft() { return this.drafts[this.current.id] ?? this.answers[this.current.id] ?? { choice: null, comment: '' }; }
  updateDraft(change) { this.drafts[this.current.id] = { choice: this.draft.choice, comment: this.draft.comment, ...change }; }
  commit() {
    if (!CHOICES.includes(this.draft.choice)) throw new Error('Choose a version first.');
    this.answers[this.current.id] = { choice: this.draft.choice, comment: this.draft.comment.trim(), reviewedAt: new Date().toISOString() };
    delete this.drafts[this.current.id];
    this.completedAt = null;
    if (this.count === this.cases.length && (!this.editMode || this.index === this.cases.length - 1)) {
      this.screen = 'complete';
      this.editMode = false;
      this.completedAt = new Date().toISOString();
    } else if (this.index < this.cases.length - 1) this.index++;
    else this.index = this.cases.findIndex(item => !this.answers[item.id]);
  }
  previous() { if (this.index > 0) this.index--; }
  jump(fighter) {
    const index = this.cases.findIndex(item => item.fighter === fighter && !this.answers[item.id]);
    this.index = index >= 0 ? index : this.cases.findIndex(item => item.fighter === fighter);
    if (this.index < 0) this.index = 0;
    this.screen = 'review';
  }
  serialize() {
    return { version: 1, datasetId: this.dataset.id, index: this.index, answers: this.answers, drafts: this.drafts,
      screen: this.screen, editMode: this.editMode, completedAt: this.completedAt };
  }
  export() {
    return {
      schemaVersion: 1, datasetId: this.dataset.id,
      animation: this.dataset.animation, direction: this.dataset.direction, frameIndex: this.dataset.frameIndex,
      adjustment: { translationX: this.dataset.shiftX, unit: 'screen pixels' },
      exportedAt: new Date().toISOString(), completedAt: this.completedAt,
      complete: this.count === this.cases.length, reviewed: this.count, total: this.cases.length,
      choiceMeaning: { before: 'Original placement preferred', after: 'Adjusted placement preferred',
        neither: 'Both need work', tie: 'Both look good' },
      decisions: this.cases.map(item => ({
        id: item.id, fighter: item.fighter, hat: item.hat,
        choice: this.answers[item.id]?.choice ?? null, comment: this.answers[item.id]?.comment ?? '',
        reviewedAt: this.answers[item.id]?.reviewedAt ?? null,
      })),
    };
  }
}
