const $ = (id) => document.getElementById(id);
const form = $('riskForm');

const translations = {
  en: { assess:'Assess PPH risk', low:'Low risk', moderate:'Moderate risk', high:'High risk' },
  yo: { assess:'Ṣàyẹ̀wò ewu PPH', low:'Ewu kékeré', moderate:'Ewu àárín', high:'Ewu gíga' },
  ha: { assess:'Tantance haɗarin PPH', low:'Ƙananan haɗari', moderate:'Matsakaicin haɗari', high:'Babban haɗari' },
  ig: { assess:'Nyochaa ihe egwu PPH', low:'Obere ihe egwu', moderate:'Ihe egwu etiti', high:'Nnukwu ihe egwu' }
};

const prep = {
  low: ['Continue routine ANC schedule and monitor haemoglobin.', 'Encourage iron-rich diet and prescribed supplements.', 'Deliver with a skilled birth attendant.'],
  moderate: ['Repeat haemoglobin and blood pressure assessment.', 'Create a documented birth and referral plan.', 'Confirm uterotonic availability at delivery facility.', 'Counsel patient on PPH warning signs.'],
  high: ['Refer for senior obstetric review and delivery planning.', 'Plan facility delivery with blood transfusion capacity.', 'Alert delivery team and confirm uterotonics are ready.', 'Correct anaemia urgently according to clinical protocol.', 'Avoid unassisted or home delivery.']
};

function values(){
  return { name:$('patientName').value.trim(), weeks:+$('gestation').value, bmi:+$('bmi').value, hb:+$('haemoglobin').value, sys:+$('systolic').value, dia:+$('diastolic').value, cs:document.querySelector('[name=cs]:checked').value==='yes' };
}

function assess(v){
  let score=0;
  const flags={};
  if(v.bmi>=30){score+=2;flags.bmi='Elevated';} else if(v.bmi<18.5){score+=1;flags.bmi='Low';}
  if(v.hb<8){score+=3;flags.hb='Severe anaemia';} else if(v.hb<11){score+=2;flags.hb='Anaemia';}
  if(v.sys>=140||v.dia>=90){score+=2;flags.bp='Elevated';}
  if(v.cs){score+=2;flags.cs='Previous CS';}
  score=Math.min(score,10);
  const tier=score>=6?'high':score>=3?'moderate':'low';
  return {score,percentage:score*10,tier,flags,source:'rule-based fallback',explanations:[]};
}

async function predict(v){
  const response=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    gestational_age:v.weeks,bmi:v.bmi,haemoglobin:v.hb,systolic_bp:v.sys,diastolic_bp:v.dia,previous_caesarean:v.cs
  })});
  if(!response.ok) throw new Error('Prediction API unavailable');
  const result=await response.json();
  return {...result,score:Math.round(result.percentage/10),flags:{},source:`AI · ${result.model.version}`};
}

function render(v,r){
  const t=translations[$('languageSelect').value];
  const labels={low:t.low,moderate:t.moderate,high:t.high};
  const titles={low:'Routine birth preparedness',moderate:'Enhanced monitoring needed',high:'Facility delivery plan required'};
  const intros={low:'No major risk factors were detected in this screen.',moderate:'One or more factors need closer follow-up before delivery.',high:'Multiple or significant factors require an escalated birth plan.'};
  $('emptyState').hidden=true;$('resultState').hidden=false;
  $('screeningDate').textContent=new Intl.DateTimeFormat('en-NG',{dateStyle:'medium'}).format(new Date());
  $('riskScore').textContent=r.percentage;$('modelStatus').textContent=r.source;$('riskBadge').textContent=labels[r.tier].toUpperCase();$('resultTitle').textContent=titles[r.tier];$('resultIntro').textContent=`${intros[r.tier]} Estimated PPH probability: ${r.percentage}%.`;
  const colors={low:'#167c6c',moderate:'#c88417',high:'#d85b45'};
  document.querySelector('.risk-ring').style.borderColor=colors[r.tier];$('riskBadge').style.color=colors[r.tier];$('riskBadge').style.background=colors[r.tier]+'18';document.querySelector('.meter span').style.cssText=`width:${Math.max(8,r.percentage)}%;background:${colors[r.tier]}`;
  const rawValues={gestational_age:`${v.weeks} weeks`,bmi:`${v.bmi} kg/m²`,haemoglobin:`${v.hb} g/dL`,systolic_bp:`${v.sys} mmHg`,diastolic_bp:`${v.dia} mmHg`,previous_caesarean:v.cs?'Yes':'No'};
  const factors=r.explanations?.length?r.explanations.map(x=>[x.label,rawValues[x.feature],x.direction]):[['BMI',`${v.bmi} kg/m²`,r.flags.bmi],['Haemoglobin',`${v.hb} g/dL`,r.flags.hb],['Blood pressure',`${v.sys}/${v.dia} mmHg`,r.flags.bp],['Caesarean history',v.cs?'Yes':'No',r.flags.cs]];
  $('factorList').innerHTML=factors.map(([k,val,flag])=>`<div class="factor ${flag==='increases'||(flag&&flag!=='reduces')?'flag':''}"><span>${k}</span><strong>${val}${flag?` · ${flag}`:''}</strong></div>`).join('');
  $('actionList').innerHTML=prep[r.tier].map(x=>`<li>${x}</li>`).join('');
  $('cardPatient').textContent=v.name;$('cardMeta').textContent=`${v.weeks} weeks gestation · Screened ${$('screeningDate').textContent}`;$('cardScore').textContent=`${r.percentage}%`;$('cardTier').textContent=`Estimated probability · ${labels[r.tier]} PPH screening result`;$('cardBadge').textContent=labels[r.tier].toUpperCase();$('cardActions').innerHTML=prep[r.tier].map(x=>`<li>${x}</li>`).join('');
  $('resultPanel').scrollIntoView({behavior:'smooth',block:'start'});
}

form.addEventListener('submit',async(e)=>{e.preventDefault();const v=values();const button=form.querySelector('.primary');button.disabled=true;button.childNodes[0].textContent='Analysing ';try{render(v,await predict(v));}catch(error){render(v,assess(v));$('modelStatus').textContent='OFFLINE FALLBACK';}finally{button.disabled=false;button.childNodes[0].textContent=translations[$('languageSelect').value].assess+' ';}});
$('sampleBtn').addEventListener('click',()=>{$('patientName').value='Amina Yusuf';$('gestation').value=34;$('bmi').value=31.2;$('haemoglobin').value=9.4;$('systolic').value=146;$('diastolic').value=92;document.querySelector('[name=cs][value=yes]').checked=true;});
$('resetBtn').addEventListener('click',()=>{form.reset();$('resultState').hidden=true;$('emptyState').hidden=false;window.scrollTo({top:0,behavior:'smooth'});});
$('printBtn').addEventListener('click',()=>window.print());
$('languageSelect').addEventListener('change',(e)=>{form.querySelector('.primary').childNodes[0].textContent=translations[e.target.value].assess+' ';});
