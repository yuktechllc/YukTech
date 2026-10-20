(function(){
  'use strict';
  // Contact enquiry form.
  // - No file attached: sent through FormSubmit's AJAX endpoint (shows real errors on the page).
  // - File attached: submitted as a normal multipart form POST (same method the Apply form uses),
  //   because FormSubmit's AJAX endpoint does NOT support file attachments.
  var form=document.getElementById('enquiryForm'); if(!form)return;
  var err=document.getElementById('enquiryError'), btn=document.getElementById('enquirySubmit');
  var file=document.getElementById('contactAttachment');
  var nextInput=document.getElementById('enquiryNext');
  var TO='aneeshjain2014@gmail.com';   // change to info@yuktech.net when going live
  var THANKS=new URL('contact-thank-you.html',window.location.href).href;
  var MAX=5*1024*1024, EXT=/\.(pdf|docx?|rtf|txt|xlsx?|pptx?|jpe?g|png)$/i;
  var label=btn.firstChild.textContent;

  if(nextInput) nextInput.value=THANKS;   // redirect target for the normal (file) submit

  function showError(msg){err.textContent=msg;err.hidden=false;err.scrollIntoView({block:'center',behavior:'smooth'});}
  function reset(){btn.disabled=false;btn.firstChild.textContent=label;}

  form.addEventListener('submit',function(e){
    err.hidden=true;
    var f=file&&file.files.length?file.files[0]:null;

    if(f){
      // Validate, then let the browser do a normal multipart POST (no preventDefault).
      if(!EXT.test(f.name)){e.preventDefault();showError('Unsupported file type. Please attach a PDF, Word, Excel, PowerPoint, text or image file.');return;}
      if(f.size>MAX){e.preventDefault();showError('Your file is larger than 5 MB. Please upload a smaller file.');return;}
      btn.disabled=true; btn.firstChild.textContent='Submitting… ';
      return;
    }

    // No attachment -> AJAX path
    e.preventDefault();
    if(!form.checkValidity()){form.reportValidity();return;}
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
