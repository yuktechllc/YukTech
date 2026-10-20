(function(){
  'use strict';
  // Contact enquiry form. Works exactly like the Apply form: a normal multipart POST
  // to FormSubmit (so attachments are delivered), with validation first.
  var form=document.getElementById('enquiryForm'); if(!form)return;
  var err=document.getElementById('enquiryError'), btn=document.getElementById('enquirySubmit');
  var file=document.getElementById('contactAttachment');
  var MAX=5*1024*1024, EXT=/\.(pdf|docx?|rtf|txt|xlsx?|pptx?|jpe?g|png)$/i;
  // Where FormSubmit sends the visitor after a successful submit
  document.getElementById('enquiryNext').value=new URL('contact-thank-you.html',window.location.href).href;

  function showError(msg){err.textContent=msg;err.hidden=false;err.scrollIntoView({block:'center',behavior:'smooth'});}

  form.addEventListener('submit',function(e){
    err.hidden=true;
    var f=file&&file.files.length?file.files[0]:null;
    if(f){
      if(!EXT.test(f.name)){e.preventDefault();showError('Unsupported file type. Please attach a PDF, Word, Excel, PowerPoint, text or image file.');return;}
      if(f.size>MAX){e.preventDefault();showError('Your file is larger than 5 MB. Please upload a smaller file.');return;}
    } else if(file){
      file.disabled=true;   // no document chosen: don't send an empty file part
    }
    btn.disabled=true; btn.firstChild.textContent='Submitting… ';
  });
})();
