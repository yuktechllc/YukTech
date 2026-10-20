(function(){
  'use strict';
  // Contact enquiry form. Sends through FormSubmit's AJAX endpoint so the real
  // result (success or the exact reason for failure) is shown on the page.
  var form=document.getElementById('enquiryForm'); if(!form)return;
  var err=document.getElementById('enquiryError'), btn=document.getElementById('enquirySubmit');
  var file=document.getElementById('contactAttachment');
  var MAX=5*1024*1024, EXT=/\.(pdf|doc|docx|rtf|txt|xls|xlsx|ppt|pptx|jpg|jpeg|png)$/i;
  var TO='aneeshjain2014@gmail.com';   // change to info@yuktech.net when going live
  var THANKS=new URL('contact-thank-you.html',window.location.href).href;
  var label=btn.firstChild.textContent;
  // Used only when a document is attached (normal form post, same as the job application form).
  document.getElementById('enquiryNext').value=THANKS;

  function showError(msg){err.textContent=msg;err.hidden=false;err.scrollIntoView({block:'center',behavior:'smooth'});}
  function reset(){btn.disabled=false;btn.firstChild.textContent=label;}

  form.addEventListener('submit',function(e){
    err.hidden=true;
    if(!form.checkValidity()){e.preventDefault();form.reportValidity();return;}
    var f=file&&file.files[0];
    if(f){
      if(!EXT.test(f.name)){e.preventDefault();showError('Please attach a PDF, Word, Excel, PowerPoint, text or image file.');return;}
      if(f.size>MAX){e.preventDefault();showError('Your file is larger than 5 MB. Please upload a smaller file.');return;}
      // With a document: let the browser post the form normally so the file is attached to the email.
      btn.disabled=true; btn.firstChild.textContent='Submitting… ';
      return;
    }
    // No document: send in the background so the result is shown on the page.
    e.preventDefault();
    var data=new FormData(form);
    data.delete('attachment');
    btn.disabled=true; btn.firstChild.textContent='Submitting… ';

    fetch('https://formsubmit.co/ajax/'+TO,{method:'POST',headers:{'Accept':'application/json'},body:data})
      .then(function(r){return r.json().catch(function(){return {success:false,message:'Unexpected response ('+r.status+').'};});})
      .then(function(j){
        if(j&&(j.success===true||j.success==='true')){window.location.href=THANKS;return;}
        reset();
        showError('We could not send your enquiry: '+((j&&j.message)||'unknown error')+' Please email info@yuktech.net instead.');
      })
      .catch(function(){
        reset();
        showError('We could not send your enquiry because the connection failed. Please try again or email info@yuktech.net.');
      });
  });
})();
