(function(){
  'use strict';
  // Contact enquiry form: works the same way as the job application form (assets/apply.js).
  var form=document.getElementById('enquiryForm'); if(!form)return;
  var err=document.getElementById('enquiryError'), btn=document.getElementById('enquirySubmit');
  var file=document.getElementById('contactAttachment');
  var MAX=5*1024*1024, EXT=/\.(pdf|doc|docx|rtf|txt|xls|xlsx|ppt|pptx|jpg|jpeg|png)$/i;

  // After FormSubmit accepts the enquiry, return the visitor to this site's thank-you page.
  document.getElementById('enquiryNext').value=new URL('contact-thank-you.html',window.location.href).href;

  function showError(msg){err.textContent=msg;err.hidden=false;err.scrollIntoView({block:'center',behavior:'smooth'});}

  form.addEventListener('submit',function(e){
    err.hidden=true;
    var f=file&&file.files[0];
    if(f){
      if(!EXT.test(f.name)){e.preventDefault();showError('Please attach a PDF, Word, Excel, PowerPoint, text or image file.');return;}
      if(f.size>MAX){e.preventDefault();showError('Your file is larger than 5 MB. Please upload a smaller file.');return;}
    } else if(file){
      // No document chosen: send a plain form (no empty file part).
      file.disabled=true;
      form.enctype='application/x-www-form-urlencoded';
    }
    btn.disabled=true; btn.firstChild.textContent='Submitting… ';
  });
})();
