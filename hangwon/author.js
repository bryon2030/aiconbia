import {client,member,signed,pdfDocument,bucket,bookColumns,esc} from './backend.js';
const $=s=>document.querySelector(s);
let recovery=false;
let authMode='login',user=null,editing=null,rows=[],active=false;
const message=(id,text)=>$(id).textContent=text;
function busy(value){active=value;document.querySelectorAll('#upload-form button, #my-books button, #auth-form button').forEach(b=>{if(value){b.dataset.preBusyDisabled=String(b.disabled);b.disabled=true;}else if('preBusyDisabled' in b.dataset){b.disabled=b.dataset.preBusyDisabled==='true';delete b.dataset.preBusyDisabled;}});}
function formReset(){editing=null;$('#upload-form').reset();$('#upload-heading').textContent='새 책 등록';$('#upload-form button[type=submit]').textContent='책 저장';drawBooks();message('#upload-status','');}
function drawBooks(){
 $('#my-books').innerHTML=rows.length?rows.map(b=>`<article class="author-book"><div><h3>${esc(b.title)}</h3><p>${esc(b.author)} · ${b.status==='published'?'서점 공개 중':'비공개 초안'}${b.page_count?' · PDF '+b.page_count+'쪽':''}</p></div><div class="actions">${b.status==='draft'?`<button class="outline" data-edit="${b.id}">${editing===b.id?'저장':'수정'}</button><button class="primary" data-publish="${b.id}" ${!b.cover_path||!b.pdf_path?'disabled':''}>서점에 공개</button>`:`<a class="outline" href="books.html#book/${b.id}">책 보기</a><button class="outline" data-hide="${b.id}">비공개로 전환</button>`}</div></article>`).join(''):'<p>등록한 책이 없습니다. 표지와 완성된 PDF로 첫 책을 등록해 보세요.</p>';
}
async function loadBooks(){const {data,error}=await client.from('hangwon_books').select(bookColumns).eq('owner_id',user.id).order('created_at',{ascending:false});if(error)throw error;rows=data;drawBooks();}
async function refresh(){
 if(recovery){$('#auth-panel').hidden=true;$('#author-panel').hidden=true;$('#recovery-panel').hidden=false;return;}
 try{user=await member();if(recovery){$('#auth-panel').hidden=true;$('#author-panel').hidden=true;$('#recovery-panel').hidden=false;return;}$('#auth-panel').hidden=true;$('#author-panel').hidden=false;$('#account-email').textContent=user.email;await loadBooks();}
 catch{user=null;rows=[];$('#auth-panel').hidden=false;$('#author-panel').hidden=true;$('#my-books').innerHTML='';}
}
function mode(value){authMode=value;$('#signup-fields').hidden=value!=='signup';$('#signup-name').required=value==='signup';$('#auth-consent').required=value==='signup';$('#password').autocomplete=value==='signup'?'new-password':'current-password';$('#password').minLength=value==='signup'?10:1;$('#auth-submit').textContent=value==='signup'?'회원가입':'로그인';document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode===value)));message('#auth-status','');}
document.querySelectorAll('[data-auth-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.authMode));
$('#auth-form').onsubmit=async e=>{
 e.preventDefault();busy(true);message('#auth-status','');
 try{
  const email=$('#email').value.trim(),password=$('#password').value;
  if(authMode==='signup'){
   if(!$('#auth-consent').checked)throw Error('회원가입 안내에 동의해 주세요.');
   const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:new URL('author.html',location.href).href,data:{display_name:$('#signup-name').value.trim()}}});
   if(error)throw error;
   message('#auth-status',data.session?'가입이 완료됐습니다.':'가입 확인 메일을 보냈습니다. 이메일에서 확인 링크를 누른 뒤 로그인해 주세요.');if(data.session)await refresh();
  }else{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await refresh();if(!user)message('#auth-status','이메일 확인을 마친 계정으로 로그인해 주세요.');}
 }catch(e){message('#auth-status',e.status===429?'요청이 많습니다. 잠시 후 다시 시도해 주세요.':authMode==='signup'?'가입하지 못했습니다. 이메일·비밀번호를 확인하고 다시 시도해 주세요.':'로그인하지 못했습니다. 이메일 확인 여부와 입력 내용을 확인해 주세요.');}
 finally{busy(false);$('#password').value='';}
};
$('#forgot-password').onclick=async()=>{
 const email=$('#email').value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return message('#auth-status','가입한 이메일 주소를 먼저 입력해주세요.');
 if(active)return;busy(true);
 try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('author.html',location.href).href});if(error)throw error;message('#auth-status','가입한 이메일이라면 비밀번호 재설정 링크를 보내드립니다. 메일함과 스팸함을 확인해주세요.');}
 catch{message('#auth-status','재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.');}finally{busy(false);}
};
$('#recovery-form').onsubmit=async e=>{
 e.preventDefault();if(!recovery||active)return;
 const password=$('#new-password').value;
 if(password.length<10)return message('#recovery-status','비밀번호는 10자 이상 입력해주세요.');
 if(password!==$('#confirm-password').value)return message('#recovery-status','두 비밀번호가 일치하지 않습니다.');
 active=true;$('#save-password').disabled=true;
 try{const {data,error:sessionError}=await client.auth.getUser();if(sessionError||!data.user)throw Error('expired');
 const {error}=await client.auth.updateUser({password});if(error)throw error;
 await client.auth.signOut();recovery=false;$('#recovery-panel').hidden=true;$('#recovery-form').reset();await refresh();mode('login');message('#auth-status','비밀번호를 변경했습니다. 이메일과 새 비밀번호로 로그인해주세요.');}
 catch{message('#recovery-status','비밀번호를 변경하지 못했습니다. 링크가 만료됐다면 재설정 메일을 다시 요청해주세요.');}
 finally{active=false;$('#save-password').disabled=false;}
};
$('#logout').onclick=async()=>{const {error}=await client.auth.signOut();if(error)return message('#account-status','로그아웃하지 못했습니다. 다시 시도해 주세요.');user=null;formReset();await refresh();};
$('#new-book').onclick=formReset;
async function validateCover(file){
 if(!file||file.size>5*1024*1024)throw Error('표지는 5MB 이하 PNG·JPG·WebP 파일로 올려주세요.');
 const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
 if(!types[file.type])throw Error('표지는 PNG·JPG·WebP만 지원합니다.');
 const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const valid=file.type==='image/png'?b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71:file.type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
 if(!valid)throw Error('표지 파일 형식을 확인해 주세요.');
 const bitmap=await createImageBitmap(file);bitmap.close();return types[file.type];
}
async function validatePdf(file){
 if(!file||file.type!=='application/pdf'||file.size>50*1024*1024)throw Error('책 파일은 50MB 이하 PDF로 올려주세요.');
 const b=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(b.slice(0,5))!=='%PDF-')throw Error('올바른 PDF 파일을 선택해 주세요.');
 let doc;try{doc=await pdfDocument(b);if(doc.numPages<1||doc.numPages>300)throw Error('PDF는 1~300쪽까지 등록할 수 있습니다.');return doc.numPages;}catch(e){throw Error(e.name==='PasswordException'?'암호를 해제한 PDF를 올려주세요.':e.message.includes('300')?e.message:'PDF를 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.');}finally{await doc?.loadingTask.destroy();}
}
$('#upload-form').onsubmit=async e=>{
 e.preventDefault();const form=e.currentTarget;if(active)return;busy(true);message('#upload-status','파일을 확인하고 있습니다.');
 const uploaded=[];let id=editing,linked=false;
 try{
  const owner=await member(),f=new FormData(form),coverFile=form.elements.cover.files[0],pdfFile=form.elements.pdf.files[0],prior=rows.find(b=>b.id===id);
  if(prior?.status==='published')throw Error('비공개로 전환한 뒤 수정해 주세요.');
  if((!coverFile&&!prior?.cover_path)||(!pdfFile&&!prior?.pdf_path))throw Error('표지와 책 PDF를 모두 선택해 주세요.');
  const extension=coverFile?await validateCover(coverFile):null,pages=pdfFile?await validatePdf(pdfFile):prior.page_count;
  const data={title:f.get('title').trim(),author:f.get('author').trim(),category:f.get('category'),summary:f.get('summary').trim(),description:f.get('description').trim()};
  if(!id){id=crypto.randomUUID();const {error}=await client.from('hangwon_books').insert({id,...data});if(error)throw error;editing=id;}
  message('#upload-status','파일을 저장하고 있습니다. 창을 닫지 마세요.');
  let coverPath=prior?.cover_path,pdfPath=prior?.pdf_path;
  for(const [file,ext,key] of [[coverFile,extension,'cover'],[pdfFile,'pdf','pdf']]){
   if(!file)continue;const live=await member();if(live.id!==owner.id)throw Error('로그인 계정이 바뀌었습니다. 다시 로그인해 주세요.');
   const dest=`${owner.id}/${id}/${key}-${crypto.randomUUID()}.${ext}`;
   const {error}=await client.storage.from(bucket).upload(dest,file,{contentType:file.type,upsert:false});if(error)throw error;uploaded.push(dest);if(key==='cover')coverPath=dest;else pdfPath=dest;
  }
  if((await member()).id!==owner.id)throw Error('로그인 계정이 바뀌었습니다.');
  const {error}=await client.from('hangwon_books').update({...data,cover_path:coverPath,pdf_path:pdfPath,page_count:pages}).eq('id',id).eq('owner_id',owner.id).select('id').single();if(error)throw error;linked=true;
  await loadBooks();formReset();message('#upload-status','비공개로 저장했습니다. 아래 내 책에서 ‘서점에 공개’를 누르면 독자에게 보입니다.');
 }catch(e){
  console.warn('Hangwon upload:',e.name,e.message);
  if(uploaded.length&&!linked)await client.storage.from(bucket).remove(uploaded).catch(()=>{});
  message('#upload-status',/표지|PDF|로그인|선택|비공개|암호|쪽/.test(e.message)?e.message:'저장하지 못했습니다. 파일은 공개되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  if(user)await loadBooks().catch(()=>{});
 }finally{busy(false);}
};
let publishing=null;
$('#my-books').onclick=async e=>{
 const button=e.target.closest('button');if(!button||active)return;
 const id=button.dataset.edit||button.dataset.publish||button.dataset.hide,b=rows.find(r=>r.id===id);if(!b)return;
 if(button.dataset.edit){if(editing===id){$('#upload-form').requestSubmit();return;}editing=id;const form=$('#upload-form');for(const key of ['title','author','category','summary','description'])form.elements[key].value=b[key];form.elements.cover.value='';form.elements.pdf.value='';$('#upload-heading').textContent='책 정보 수정';$('#upload-form button[type=submit]').textContent='수정 내용 저장';drawBooks();message('#upload-status','이미 저장된 파일은 유지됩니다. 교체할 파일만 선택해 주세요.');form.scrollIntoView({behavior:'smooth'});form.elements.title.focus({preventScroll:true});}
 if(button.dataset.publish){publishing=id;$('#publish-title').textContent=b.title;$('#publish-consent').checked=false;$('#publish-dialog').showModal();}
 if(button.dataset.hide){busy(true);try{await changeStatus(id,'draft');message('#account-status','책을 비공개로 전환했습니다. 이미 발급된 파일 링크는 최대 5분 후 만료됩니다.');}catch{message('#account-status','변경하지 못했습니다. 다시 시도해 주세요.');}finally{busy(false);}}
};
async function changeStatus(id,status){const owner=await member();const {error}=await client.from('hangwon_books').update({status}).eq('id',id).eq('owner_id',owner.id).select('id').single();if(error)throw error;await loadBooks();}
$('#cancel-publish').onclick=()=>$('#publish-dialog').close();
$('#publish-form').onsubmit=async e=>{e.preventDefault();if(!$('#publish-consent').checked)return;$('#confirm-publish').disabled=true;try{await changeStatus(publishing,'published');$('#publish-dialog').close();message('#account-status','서점에 공개했습니다. 내 책의 ‘책 보기’에서 확인할 수 있습니다.');}catch{message('#publish-status','공개하지 못했습니다. 표지와 PDF가 모두 저장됐는지 확인해 주세요.');}finally{$('#confirm-publish').disabled=false;}};
client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')recovery=true;setTimeout(()=>{if(!active)refresh();},0);});
mode('login');await refresh();
