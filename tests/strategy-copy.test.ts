import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TaskImage } from '../src/types/kanban';
import { createStrategySeed, parseStrategy, setStrategyConnection, setStrategySubtaskCompleted } from '../src/utils/strategy';
import { appendStrategyCopy, copyStrategyImages, createStrategyCopyPlan } from '../src/utils/strategyCopy';
import { copiedTaskImage, validTaskImage } from '../src/utils/taskImageValidation';

const makeIds = () => { let i = 0; return () => 'copy-' + (++i); };
const photo = (id = 'photo'): TaskImage => ({ id, name: 'Zdjęcie.png', path: '10000000-0000-4000-a000-000000000001/strategy-light/' + id + '.png', size: 1234, mimeType: 'image/png', uploadedAt: '2026-10-25T12:00:00Z' });

test('single copy preserves full content and progress while all editable objects are independent', () => {
  const data = parseStrategy(createStrategySeed());
  const source = data.cards.find(c => c.task.id === 'strategy-light')!;
  Object.assign(source.task, { descriptionHtml: '<p><strong>Światło</strong></p>', color: '#0d9488', status: 'in_progress', priority: 'high', dueDate: '2026-12-01', assigneeId: 'jan', assigneeIds: ['jan','daro'], tags: ['KNX'], subtasks: [{id:'step',title:'Sceny',completed:true}], statusComments: [{id:'comment',text:'Ustalono',timestamp:'2026-10-25T12:00:00Z',author:'Darek'}], closingStatus: 'Próba gotowa', githubIssueNumber: 14 });
  const original = structuredClone(data);
  const plan = createStrategyCopyPlan(data, source.task.id, { descendants: false, keepParents: false }, makeIds());
  const copy = plan.cards[0];
  assert.equal(copy.task.title, 'Oświetlenie — kopia');
  assert.deepEqual(copy.parentIds, []);
  assert.notEqual(copy.task.id, source.task.id);
  for (const key of ['description','descriptionHtml','color','status','priority','dueDate','assigneeIds','tags','closingStatus'] as const) assert.deepEqual(copy.task[key],source.task[key]);
  assert.notEqual(copy.task.subtasks[0].id, 'step');
  assert.equal(copy.task.subtasks[0].completed, true);
  assert.equal(copy.task.statusComments![0].timestamp, source.task.statusComments![0].timestamp);
  assert.notEqual(copy.task.statusComments![0].id, 'comment');
  assert.equal(copy.task.githubIssueNumber, undefined);
  assert.ok(copy.position.x > Math.max(...data.cards.map(c => c.position.x)));
  assert.equal(plan.cards.length, 1);
  let saved = appendStrategyCopy(data, plan);
  saved = setStrategySubtaskCompleted(saved, copy.task.id, copy.task.subtasks[0].id, false);
  assert.equal(saved.cards.find(c=>c.task.id===source.task.id)!.task.subtasks[0].completed,true);
  assert.deepEqual(data, original);
  copy.task.tags.push('New');
  assert.deepEqual(saved.cards.find(c=>c.task.id===copy.task.id)!.task.tags,['KNX']);
});

test('branch copies a shared descendant once, remaps internal links and drops links outside the copy', () => {
  let data = setStrategyConnection(createStrategySeed(), 'strategy-light', 'strategy-0-3', true);
  data = setStrategyConnection(data, 'strategy-light', 'strategy-1-0', true);
  const before = structuredClone(data);
  const plan = createStrategyCopyPlan(data, 'strategy-0-0', { descendants: true, keepParents: false }, makeIds());
  assert.equal(plan.cards.length, 7);
  const light = plan.cards.find(c=>c.task.title==='Oświetlenie')!;
  assert.equal(light.parentIds.length, 2);
  assert.ok(light.parentIds.every(id=>plan.cards.some(c=>c.task.id===id)));
  assert.equal(plan.cards.filter(c=>c.task.title==='Scena „Powrót”').length,1);
  assert.deepEqual(plan.cards.find(c=>c.task.title==='Scena „Powrót”')!.parentIds,[light.task.id]);
  assert.equal(appendStrategyCopy(data, plan).cards.length,39);
  assert.deepEqual(data,before);
  const withParents=createStrategyCopyPlan(data,'strategy-light',{descendants:false,keepParents:true},makeIds());
  assert.deepEqual(withParents.cards[0].parentIds,data.cards.find(c=>c.task.id==='strategy-light')!.parentIds);
});

test('copy appends against latest data and retrying an uncertain save never duplicates it', () => {
  const data = createStrategySeed();
  const plan = createStrategyCopyPlan(data, 'strategy-light', { descendants: true, keepParents: false }, makeIds());
  const latest = structuredClone(data); latest.cards[0].task.title='Nowy tytuł Dara'; latest.cards[0].position.x+=23;
  const result = appendStrategyCopy(latest, plan);
  assert.deepEqual(result.cards[0],parseStrategy(latest).cards[0]);
  assert.equal(appendStrategyCopy(result,plan),result);
  assert.throws(()=>appendStrategyCopy({...result,cards:result.cards.filter(c=>c.task.id!==plan.rootId)},plan),/Część kopii/);
  assert.throws(()=>createStrategyCopyPlan(data,'missing',{descendants:false,keepParents:false}),/usunięta/);
});

test('copy rejects board limits before storage writes and truncates a long copy title', () => {
  const seed=createStrategySeed();
  seed.cards[0].task.title='a'.repeat(300);
  assert.equal(createStrategyCopyPlan(seed,seed.cards[0].task.id,{descendants:false,keepParents:false}).cards[0].task.title.length,300);
  const full={...seed,cards:Array.from({length:1000},(_,i)=>({...seed.cards[0],task:{...seed.cards[0].task,id:'task-'+i},parentIds:[]}))};
  assert.throws(()=>createStrategyCopyPlan(full,'task-0',{descendants:false,keepParents:false}),/rozmiar/);
});

test('photos receive their own task paths, partial failure is retryable and cannot publish incomplete cards', async () => {
  const data=createStrategySeed(); data.cards.find(c=>c.task.id==='strategy-light')!.task.images=[photo('one'),photo('two')];
  const plan=createStrategyCopyPlan(data,'strategy-light',{descendants:false,keepParents:false},makeIds());
  assert.throws(()=>appendStrategyCopy(data,plan),/zdjęć/);
  let calls=0, fail=true;
  const repository={copy:async(image:TaskImage,id:string)=>{calls++;if(image.id==='two'&&fail)throw new Error('Offline');return copiedTaskImage(image,id);}};
  await assert.rejects(copyStrategyImages(plan,repository),/Offline/);
  assert.equal(plan.images.filter(i=>i.copied).length,1);
  assert.throws(()=>appendStrategyCopy(data,plan),/zdjęć/);
  fail=false;await copyStrategyImages(plan,repository);
  assert.equal(calls,3);
  const result=appendStrategyCopy(data,plan),copy=result.cards.find(c=>c.task.id===plan.rootId)!;
  assert.ok(copy.task.images!.every(i=>validTaskImage(i,copy.task.id)));
  assert.deepEqual(data.cards.find(c=>c.task.id==='strategy-light')!.task.images,[photo('one'),photo('two')]);
  assert.ok(copy.task.images!.every(i=>!data.cards.find(c=>c.task.id==='strategy-light')!.task.images!.some(o=>o.path===i.path)));
});
