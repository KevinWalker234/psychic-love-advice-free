(function(){
'use strict';
var ov=document.getElementById('plafMobileOverlay');
var nv=document.getElementById('plafMobileNav');
var hd=document.getElementById('plafHeader');
var btn=document.getElementById('plafMobileBtn');
function setExpanded(isOpen){
	if(btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}
window.plafToggleMobile=function(){
	if(!nv) return;
	var isOpen = nv.classList.toggle('open');
	if(ov) ov.classList.toggle('open', isOpen);
	document.body.classList.toggle('nav-open', isOpen);
	setExpanded(isOpen);
};
window.plafCloseMobile=function(){
	if(nv) nv.classList.remove('open');
	if(ov) ov.classList.remove('open');
	document.body.classList.remove('nav-open');
	setExpanded(false);
};
if(hd){window.addEventListener('scroll',function(){hd.style.boxShadow=window.scrollY>10?'var(--shadow-md)':'none';});}
window.addEventListener('resize',function(){if(window.innerWidth>768)window.plafCloseMobile();});
})();
