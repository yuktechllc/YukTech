(function(){
  'use strict';
  // Contact enquiry form. Sends through FormSubmit's AJAX endpoint so the real
  // result (success or the exact reason for failure) is shown on the page.
  var form=document.getElementById('enquiryForm'); if(!form)return;
  var err=document.getElementById('enquiryError'), btn=document.getElementById('enquirySubmit');
  var file=document.getElementById('contactAttachment');
  var TO='aneeshjain2014@gmail.com';   // change to info@yuktech.net when going live
  var THANKS=new URL('contact-thank-you.html',window.location.href).href;
  var label=btn.firstChild.textContent;

  function showError(msg){err.textContent=msg;err.hidden=false;err.scrollIntoView({block:'center',behavior:'smooth'});}
  function reset(){btn.disabled=false;btn.firstChild.textContent=label;}

  form.addEventListener('submit',function(e){
    e.preventDefault();
    err.hidden=true;
    if(!form.checkValidity()){form.reportValidity();return;}
    if(file&&file.files.length){
      showError('Documents cannot be attached to this form. Please remove the file and submit, or email it to info@yuktech.net.');
      return;
    }
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
