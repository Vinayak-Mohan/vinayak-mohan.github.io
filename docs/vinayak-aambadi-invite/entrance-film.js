// Keep the door usable while the selected entrance film buffers.
(() => {
  function buffered(video) {
    if(video.readyState<2 || !Number.isFinite(video.duration)) return false;
    for(let i=0;i<video.buffered.length;i++) {
      if(video.buffered.start(i)<.1 && video.buffered.end(i)>=video.duration-.1) return true;
    }
    return false;
  }
  function selectSource(video) {
    const variant=matchMedia('(max-width:700px)').matches?'mobile':'desktop';
    const source=video.dataset[variant];
    video.muted=true;
    video.playsInline=true;
    if(source && video.getAttribute('src')!==source){video.src=source;video.load();}
    return source;
  }
  window.prepareInvitationFilm=video=>{
    if(navigator.connection?.saveData)return;
    video.preload='auto';
    selectSource(video);
  };
  window.playInvitationEntrance=async({gate,reduced,reveal,unlocked})=>{
    const video=gate.querySelector('.entrance-film');
    if(!video || reduced.matches || !selectSource(video))return false;
    let finished=false,timer,startTimer,stallTimer,waiting=0,frameCallback=0;
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
    const onWaiting=()=>{
      waiting++;
      if(!gate.classList.contains('film-playing'))return;
      clearTimeout(stallTimer);
      stallTimer=setTimeout(()=>finish('stalled'),2000);
    };
    const onPlaying=()=>{
      clearTimeout(startTimer);
      clearTimeout(stallTimer);
      if(!gate.classList.contains('film-playing')) {
        gate.style.setProperty('--entrance-duration',(video.duration/video.playbackRate)+'s');
      }
      gate.classList.remove('film-buffering');
      gate.classList.add('film-playing');
    };
    const finish=reason=>{
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      clearTimeout(startTimer);
      clearTimeout(stallTimer);
      video.pause();
      video.removeEventListener('ended',onEnded);
      video.removeEventListener('error',onError);
      video.removeEventListener('waiting',onWaiting);
      video.removeEventListener('playing',onPlaying);
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
    video.addEventListener('waiting',onWaiting);
    video.addEventListener('playing',onPlaying);
    gate.classList.add('film-buffering');
    video.preload='auto';
    timer=setTimeout(()=>finish('timeout'),14000);
    await unlocked;
    if(finished)return true;
    if(video.error){finish('error');return true;}
    video.addEventListener('error',onError,{once:true});
    startTimer=setTimeout(()=>finish('unbuffered'),4300);
    initialQuality=quality();
    lastDropped=initialQuality?.droppedVideoFrames||0;
    if(debug && video.requestVideoFrameCallback)frameCallback=video.requestVideoFrameCallback(watchFrame);
    video.defaultPlaybackRate=video.playbackRate=1.15;
    try{
      await video.play();
      if(finished)video.pause();
    }catch{finish('blocked');}
    return true;
  };
})();
