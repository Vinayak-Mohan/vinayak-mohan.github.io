(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const gate = document.querySelector('.invite-gate');
  const main = document.querySelector('#invitation-content');
  let started = false;
  let coverRevealed = false;
  function startScenes() {
    if (started) return;
    started = true;
    const observer = new IntersectionObserver(entries => entries.forEach(({target,isIntersecting}) => {
      target.classList.toggle('in-view', isIntersecting);
    }),{threshold:.08});
    document.querySelectorAll('.scene').forEach(section=>observer.observe(section));
    if (reduced.matches || !window.gsap) return;

    const canopy = [...main.querySelectorAll('.canopy-plane > img')];
    // The flowers arrive from overhead as the doorway fades. A child transform
    // keeps this entrance separate from each parent's native scroll timeline.
    const canopyEntrance = gsap.fromTo(canopy,{opacity:0,y:-85,rotation:-1.5},{
      opacity:1,y:0,rotation:0,duration:1.65,
      delay:coverRevealed ? .25 : 0,stagger:.17,ease:'power2.out',
      clearProps:'opacity,transform'
    });

    // Reveal individual reading blocks, not whole tall sections: on phones the
    // illustration may enter much later than its heading. Keep native parallax
    // on the parent wrappers independent of these short, once-only entrances.
    const selector = [
      '.cover-copy > p', '.letter-copy > p', '.light-copy > p',
      '.memory-copy > p', '.closing-copy > p', '.closing-copy > a',
      '[data-words] > span', '[data-words] > i', '.fine-ornament',
      '.cover-couple img', '.letter-couple img', '.swing img', '.depth-asset > img'
    ].join(',');
    const items = [...main.querySelectorAll(selector)];
    const order = new Map(items.map((item,index)=>[item,index]));
    const nextStart = new WeakMap();
    const played = new WeakSet();
    const active = new Map();
    const clear = target => {
      active.get(target)?.kill();
      active.delete(target);
      gsap.set(target,{clearProps:'opacity,transform'});
    };
    const reveals = new IntersectionObserver(entries => {
      entries.sort((a,b)=>order.get(a.target)-order.get(b.target));
      for (const entry of entries) {
        const target = entry.target;
        // Fast scrolling and deep links must never leave earlier content hidden.
        if (entry.boundingClientRect.bottom <= 0) {
          clear(target);
          played.add(target);
          reveals.unobserve(target);
          continue;
        }
        if (!entry.isIntersecting || played.has(target)) continue;
        played.add(target);
        const section = target.closest('.scene');
        const now = performance.now()/1000;
        const arrival = coverRevealed && section.id==='top' ? .35 : .05;
        const at = Math.min(Math.max(now+arrival,nextStart.get(section)||0),now+2.8);
        nextStart.set(section,at+.30);
        const art = target.matches('.cover-couple img,.letter-couple img,.swing img,.depth-asset > img');
        const hanging = target.matches('.layer-festoon > img');
        active.set(target,gsap.to(target,{
          opacity:1,y:0,duration:hanging?1.5:art?1.05:.78,delay:at-now,
          ease:'power2.out',clearProps:'opacity,transform',
          onComplete:()=>active.delete(target)
        }));
      }
    },{threshold:0,rootMargin:'0px 0px -7% 0px'});
    // Content is visible by default if animation support is unavailable.
    gsap.set(items,{opacity:0,y:(_index,target)=>target.matches('.cover-couple img,.layer-festoon > img')?0:16});
    items.forEach(item=>reveals.observe(item));
    const showAll = () => {
      reveals.disconnect();
      items.forEach(clear);
      canopyEntrance.kill();
      gsap.set(canopy,{clearProps:'opacity,transform'});
    };
    reduced.addEventListener('change',event=>{if(event.matches)showAll();});
    // Keyboard users need an immediately visible destination, even mid-sequence.
    main.addEventListener('focusin',event=>{
      items.filter(item=>item===event.target||item.contains(event.target)).forEach(item=>{
        clear(item);played.add(item);reveals.unobserve(item);
      });
    });
  }
  // The invitation is fully usable without JS. Deep links bypass the entrance.
  if (gate && main && (!location.hash || location.hash==='#top')) {
    gate.hidden=false;
    main.inert=true;
    document.documentElement.classList.add('invitation-sealed');
    const seal=gate.querySelector('button');
    const action=gate.querySelector('.gate-action');
    const hint=gate.querySelector('.gate-hint');
    const film=gate.querySelector('.entrance-film');
    let opening=false;
    window.bindInvitationHandle?.({gate,button:seal});
    gate.classList.add('is-ready');
    if(film && !reduced.matches)window.prepareInvitationFilm?.(film);
    seal.addEventListener('click',async()=>{
      if(opening || seal.disabled) return;
      opening=true;
      seal.disabled=true;
      action.textContent='Unlocking the doors';
      hint.textContent='Welcome to our celebration';
      coverRevealed=true;
      scrollTo({top:0,behavior:'instant'});
      gate.classList.add('opening');
      const unlocked=reduced.matches?Promise.resolve():new Promise(resolve=>setTimeout(()=>{
        action.textContent='Opening the doors';
        resolve();
      },880));
      let revealTimer;
      const finish=()=>{
        if(gate.hidden) return;
        clearTimeout(revealTimer);
        gate.hidden=true;
        main.classList.remove('film-arrival');
        main.inert=false;
        document.documentElement.classList.remove('invitation-sealed');
        gate.dispatchEvent(new Event('invite-opened'));
        const title=document.querySelector('#names');
        title.setAttribute('tabindex','-1');
        title.focus({preventScroll:true});
      };
      const revealFromFilm=()=>{
        startScenes();
        if(reduced.matches){finish();return;}
        // Browsers may suspend animation frames in a background/occluded tab.
        // Releasing focus and scrolling must not depend on that animation clock.
        revealTimer=setTimeout(finish,1500);
        gate.classList.add('film-revealing');
        main.classList.add('film-arrival');
      };
      if(window.playInvitationEntrance && await window.playInvitationEntrance({gate,reduced,reveal:revealFromFilm,unlocked})) return;
      await unlocked;
      // The same stationary reveal also covers reduced motion, absent media,
      // and browsers without the animation library. Never zoom the hero crop.
      revealFromFilm();
    });

  } else startScenes();
  const prepare=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{
    if(!isIntersecting)return;
    target.querySelectorAll('img[loading="lazy"]').forEach(img=>{
      img.loading='eager';img.decode?.().catch(()=>{});
    });
    prepare.unobserve(target);
  }),{rootMargin:'600px 0px'});
  const prepareScenes=()=>document.querySelectorAll('.letter,.memory,.celebrations,.closing').forEach(section=>prepare.observe(section));
  // Avoid large illustration decodes competing with the entrance film.
  if(gate && !gate.hidden)gate.addEventListener('invite-opened',prepareScenes,{once:true});
  else prepareScenes();
})();
