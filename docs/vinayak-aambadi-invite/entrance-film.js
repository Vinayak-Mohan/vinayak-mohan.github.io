// Prebuffer this short, one-shot film so network stalls cannot interrupt it.
(() => {
  const events=['progress','loadeddata','canplaythrough','durationchange'];
  function buffered(video) {
    if(video.readyState<2 || !Number.isFinite(video.duration)) return false;
    for(let i=0;i<video.buffered.length;i++) {
      if(video.buffered.start(i)<.1 && video.buffered.end(i)>=video.duration-.1) return true;
    }
    return false;
  }
  function waitForBuffer(video,timeout) {
    if(buffered(video)) return Promise.resolve(true);
    return new Promise(resolve=>{
      let timer;
      const done=ready=>{
        clearTimeout(timer);
        events.forEach(event=>video.removeEventListener(event,check));
        video.removeEventListener('error',failed);
        resolve(ready);
      };
      const check=()=>{if(buffered(video))done(true);};
      const failed=()=>done(false);
      events.forEach(event=>video.addEventListener(event,check));
      video.addEventListener('error',failed,{once:true});
      timer=setTimeout(failed,timeout);
      check();
    });
  }
  function selectSource(video) {
    const variant=matchMedia('(max-width:700px)').matches?'mobile':'desktop';
    const source=video.dataset[variant];
    const assets=video.dataset.assets||'assets/entrance-film-v1';
    video.poster=assets+'/'+variant+'-closed.webp';
    video.muted=true;
    video.playsInline=true;
    if(source && video.getAttribute('src')!==source){video.src=source;video.load();}
    return source;
  }
  window.prepareInvitationFilm=video=>{
    if(navigator.connection?.saveData)return Promise.resolve(false);
    video.preload='auto';
    selectSource(video);
    return waitForBuffer(video,4500);
  };
  window.playInvitationEntrance=async({gate,reduced,reveal})=>{
    const video=gate.querySelector('.entrance-film');
    if(!video || reduced.matches || !selectSource(video))return false;
    let finished=false,timer,waiting=0,frameCallback=0;
    const debug=new URLSearchParams(location.search).has('entrance-debug');
    const quality=()=>video.getVideoPlaybackQuality?.();
    let initialQuality,lastDropped=0;
    const dropMoments=[];
    const watchFrame=(_now,frame)=>{
      const q=quality();
      if(q && q.droppedVideoFrames>lastDropped)dropMoments.push({at:frame.mediaTime,count:q.droppedVideoFrames-lastDropped});
      if(q)lastDropped=q.droppedVideoFrames;
      if(!finished)frameCallback=video.requestVideoFrameCallback(watchFrame);
    };
    const onWaiting=()=>waiting++;
    const finish=reason=>{
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      video.pause();
      video.removeEventListener('ended',onEnded);
      video.removeEventListener('error',onError);
      video.removeEventListener('waiting',onWaiting);
      if(frameCallback)video.cancelVideoFrameCallback?.(frameCallback);
      if(debug){
        const final=quality();
        video.dataset.playbackAudit=JSON.stringify({reason,duration:video.duration,position:video.currentTime,
          speed:video.playbackRate,fullyBuffered:buffered(video),waitingEvents:waiting,
          totalFrames:final?final.totalVideoFrames-(initialQuality?.totalVideoFrames||0):null,
          droppedFrames:final?final.droppedVideoFrames-(initialQuality?.droppedVideoFrames||0):null,
          dropMoments,width:video.videoWidth,height:video.videoHeight});
      }
      gate.classList.remove('film-buffering');
      gate.classList.add('film-finished');
      if(video.readyState<2)gate.classList.remove('film-playing');
      reveal();
    };
    const onEnded=()=>finish('ended');
    const onError=()=>finish('error');
    video.addEventListener('ended',onEnded,{once:true});
    video.addEventListener('error',onError,{once:true});
    video.addEventListener('waiting',onWaiting);
    gate.classList.add('film-buffering');
    video.preload='auto';
    timer=setTimeout(()=>finish('timeout'),14000);
    const ready=await waitForBuffer(video,3500);
    if(finished)return true;
    if(!ready){finish('unbuffered');return true;}
    initialQuality=quality();
    lastDropped=initialQuality?.droppedVideoFrames||0;
    if(debug && video.requestVideoFrameCallback)frameCallback=video.requestVideoFrameCallback(watchFrame);
    video.defaultPlaybackRate=video.playbackRate=1.15;
    gate.style.setProperty('--entrance-duration',(video.duration/video.playbackRate)+'s');
    gate.classList.remove('film-buffering');
    gate.classList.add('film-playing');
    try{
      await video.play();
      if(finished)video.pause();
    }catch{finish('blocked');}
    return true;
  };
})();
