const state = {
  time: 60, score: 0, running: false, ended: false, timeline: false,
  paintingClue: false, clockClue: false, chestUnlocked: false,
  wrongAttempts: 0, actions: 0, rewardGiven: false, timerId: null,
  notes: new Set(), discovered: new Set()
};

const $ = id => document.getElementById(id);
const objects = document.querySelectorAll(".object");

function pad(n){ return String(n).padStart(2,"0"); }

function showNotice(text, type=""){
  const n=$("notice"); n.textContent=text; n.className="notice show "+type;
  clearTimeout(showNotice.t); showNotice.t=setTimeout(()=>n.className="notice",2300);
}
function addNote(title,text,good=false){
  if($("clueLog").querySelector(".empty-log")) $("clueLog").innerHTML="";
  const el=document.createElement("div"); el.className="log-item"+(good?" good":"");
  el.innerHTML=`<strong>${title}</strong>${text}`;
  $("clueLog").prepend(el);
}
function discover(item){
  if(state.discovered.has(item)) return;
  state.discovered.add(item);
  const wrap=$("inventoryItems");
  const empty=wrap.querySelector(".empty-inventory"); if(empty) empty.remove();
  const tag=document.createElement("span"); tag.textContent=item; wrap.appendChild(tag);
}
function updateHud(){
  $("timer").textContent=pad(state.time);
  $("score").textContent=state.score;
  $("actionsCount").textContent=`${state.actions} ACTION${state.actions===1?"":"S"}`;
  $("stateLabel").textContent=state.timeline?"CHANGED":"UNCHANGED";
  $("stageLabel").textContent=state.timeline?"ROOM II · AFTER":"ROOM I · BEFORE";
  $("timer").classList.toggle("warning",state.time<=20&&state.time>10);
  $("timer").classList.toggle("critical",state.time<=10);
}
function spendAction(){ state.actions++; updateHud(); }

function openModal(title,text,icon="◈",extra="",action=null){
  $("modalTitle").textContent=title; $("modalText").innerHTML=text; $("modalIcon").textContent=icon;
  $("modalExtra").innerHTML=extra;
  const btn=$("modalAction");
  if(action){btn.classList.remove("hidden");btn.textContent=action.label;btn.onclick=()=>{action.fn();closeModal();};}
  else btn.classList.add("hidden");
  $("modal").classList.remove("hidden");
}
function closeModal(){ $("modal").classList.add("hidden"); $("modalExtra").innerHTML=""; }
$("modalClose").onclick=closeModal;
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal();});

function investigate(type){
  if(state.ended) return;
  spendAction();
  if(type==="painting"){
    if(!state.paintingClue){
      state.paintingClue=true; discover("PAINTING: 27");
      addNote("PAINTING","A hidden inscription appears beneath the frame: <b>27</b>.",true);
      state.score+=10;
      showNotice("Hidden clue discovered · +10 score","good");
      openModal("A hidden number","Behind the painting you find two fragments: <b>27</b> and <b>19</b>.<br><br>The painting gives the first two digits: <b>27</b>. The clock must reveal the final two.","◈");
    } else {
      openModal("The painting","The portrait seems to watch you. Its hidden inscription still reads <b>27 — 19</b>.","◈");
    }
  }
  if(type==="clock"){
    if(!state.clockClue){
      state.clockClue=true; discover("CLOCK: 19");
      addNote("CLOCK","The stopped minute hand points to <b>19</b>. A faint engraving says: “Read the face last.”",true);
      state.score+=5;
      showNotice("Clock clue discovered · +5 score","good");
      openModal("The stopped clock","The clock is frozen. The minute hand points to <b>19</b>. An engraving underneath says: <em>“Read the face last.”</em><br><br>Maybe the painting gave you the first part and the clock gives you the final pair.","◷");
    } else openModal("The clock","Frozen at 19. The engraving reads: <em>“Read the face last.”</em>","◷");
  }
  if(type==="desk"){
    openModal("The desk","Dust covers everything except a clean rectangle where something used to sit. One drawer is jammed. A pencil beside it is marked <b>2 / 7 / 1 / 9</b>.","▣");
    addNote("DESK","The pencil markings echo the painting's numbers.");
  }
  if(type==="bookshelf"){
    openModal("The bookshelf","Old books lean at impossible angles. One spine reads <em>“TIME IS A ROOM”</em>. Another is blank, as if its title has been erased.","▤");
    addNote("BOOKS","“TIME IS A ROOM.” The phrase feels less metaphorical than it should.");
  }
  if(type==="chest") openChest();
  if(type==="door") tryEscape();
}

function openChest(){
  if(state.chestUnlocked){
    if(!state.discovered.has("BRASS EXIT KEY")){
      discover("BRASS EXIT KEY");
      showNotice("Brass key acquired · Find the exit","good");
      addNote("KEY","The chest contains a warm brass key. The exit should respond now.",true);
    }
    openModal("The chest is open","Inside is a brass key. It feels warm despite the cold room.<br><br><b>The exit is waiting.</b>","🔑");
    return;
  }
  if(!state.paintingClue || !state.clockClue){
    openModal("Locked chest","A four-digit lock blocks the lid. You have not found enough information yet.","▣","<div class='code-hint'>Investigate the painting and wall clock for the complete code.</div>");
    return;
  }
  const extra=`<div class="code-box"><input id="codeInput" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"><button id="submitCode">UNLOCK</button></div><div id="codeFeedback" class="feedback"></div>`;
  openModal("Four-digit lock","The clues combine into one sequence. The painting gives <b>27</b>; the clock gives <b>19</b>. Enter the four digits in that order. The lock expects four digits.","▣",extra);
  setTimeout(()=>{
    const input=$("codeInput"), btn=$("submitCode"); if(!input)return;
    input.focus();
    const submit=()=>{
      const code=input.value.trim();
      if(code==="2719"){
        state.chestUnlocked=true; state.score+=25; discover("CHEST UNLOCKED");
        $("codeFeedback").textContent="Correct. The mechanism clicks open.";
        $("codeFeedback").className="feedback good";
        showNotice("Correct code · +25 score","good");
        addNote("CHEST","Code accepted. The chest opens and reveals a warm brass key.",true);
        setTimeout(()=>{closeModal(); triggerTimeline();},650);
      } else {
        state.wrongAttempts++;
        $("codeFeedback").textContent=`Incorrect code. Attempt ${state.wrongAttempts}/3.`;
        $("codeFeedback").className="feedback bad";
        addNote("LOCK","Wrong code entered.");
        if(state.wrongAttempts >= 3){
          state.time=Math.max(0,state.time-10); state.wrongAttempts=0;
          updateHud(); showNotice("Three failed attempts · −10 seconds","bad");
          addNote("TIME","The lock shocks the room. <b>10 seconds lost.</b>","bad");
          if(state.time===0) endGame("trapped");
        }
      }
    };
    btn.onclick=submit; input.addEventListener("keydown",e=>{if(e.key==="Enter")submit()});
  },30);
}

function triggerTimeline(){
  if(state.timeline) return;
  state.timeline=true; updateHud();
  // Visual state shift: painting disappears, desk moves, a new clue appears.
  $("room").classList.add("changed");
  $("painting").style.opacity="0";
  $("painting").style.pointerEvents="none";
  $("desk").style.left="34%";
  $("desk").style.bottom="18%";
  $("newClue").classList.remove("hidden");
  $("timelineEcho").classList.remove("hidden");
  setTimeout(()=>$("timelineEcho").classList.add("hidden"),3500);
  addNote("TIMELINE","<b>You change the future.</b> The painting vanishes. The desk has moved. A new mark is visible near the door.",true);
  discover("FUTURE MARK: 04");
  state.score+=15; state.time=Math.min(60,state.time+5); updateHud();
  showNotice("You change the future · +5 seconds","good");
  setTimeout(()=>openModal("You change the future.","The room has shifted. The painting is gone. The desk moved closer to the center. A new mark has appeared beside the exit: <b>04</b>.<br><br>The room reacts to what you did. Do not assume the next moment will behave like the last.","◈"),700);
}

function tryEscape(){
  spendAction();
  if(!state.chestUnlocked || !state.discovered.has("BRASS EXIT KEY")){
    openModal("The exit","The door will not move. You need the brass key from the chest.","▱");
    return;
  }
  discover("ESCAPED");
  endGame(state.time>20?"perfect":"narrow");
}

function endGame(kind){
  if(state.ended)return;
  state.ended=true; state.running=false; clearInterval(state.timerId);
  const end=$("ending"), title=$("endingTitle"), text=$("endingText"), kicker=$("endingKicker"), stats=$("endingStats");
  end.className="ending "+kind;
  if(kind==="perfect"){
    kicker.textContent="PERFECT ESCAPE"; title.textContent="You beat the clock.";
    text.textContent="The door opens with time to spare. Behind you, the room goes silent. You never find out what would have happened at zero.";
  } else if(kind==="narrow"){
    kicker.textContent="NARROW ESCAPE"; title.textContent="You made it.";
    text.textContent="The lock gives way just before the final seconds disappear. You step through as the room's clock starts ticking again.";
  } else {
    kicker.textContent="THE ROOM REMEMBERS"; title.textContent="Trapped in Time";
    text.textContent="The final second disappears. The room resets around you, but the door is gone. Somewhere, the clock starts counting from sixty again.";
  }
  stats.innerHTML=`<div>TIME<strong>${pad(state.time)}s</strong></div><div>SCORE<strong>${state.score}</strong></div><div>ACTIONS<strong>${state.actions}</strong></div>`;
  end.classList.remove("hidden");
}

function tick(){
  if(!state.running||state.ended)return;
  state.time--;
  updateHud();
  if(state.time<=0) endGame("trapped");
}
function reset(){
  // Fully stop any previous run before rebuilding the game state.
  if(state.timerId) clearInterval(state.timerId);

  Object.assign(state,{
    time:60, score:0, running:true, ended:false, timeline:false,
    paintingClue:false, clockClue:false, chestUnlocked:false,
    wrongAttempts:0, actions:0, rewardGiven:false, timerId:null
  });

  // Sets are kept for the current run only.
  state.notes.clear();
  state.discovered.clear();

  // Reset visible UI safely. This avoids a hard crash if an element is
  // missing because an older copy of index.html is being used.
  const clueLog = $("clueLog");
  if(clueLog){
    clueLog.innerHTML='<div class="empty-log">Investigate the room.<br><span>Every detail may matter.</span></div>';
  }

  const inventory = $("inventoryItems");
  if(inventory){
    inventory.innerHTML='<span class="empty-inventory">Nothing yet</span>';
  }

  const painting = $("painting");
  if(painting){
    painting.style.opacity="";
    painting.style.pointerEvents="";
  }

  const desk = $("desk");
  if(desk){
    desk.style.left="25%";
    desk.style.bottom="13%";
  }

  const newClue = $("newClue");
  if(newClue) newClue.classList.add("hidden");

  const timelineEcho = $("timelineEcho");
  if(timelineEcho) timelineEcho.classList.add("hidden");

  const modal = $("modal");
  if(modal) modal.classList.add("hidden");

  const ending = $("ending");
  if(ending) ending.className="ending hidden";

  const gameScreen = $("gameScreen");
  if(gameScreen) gameScreen.classList.remove("hidden");

  const startScreen = $("startScreen");
  if(startScreen) startScreen.classList.add("hidden");

  updateHud();
  showNotice("60 seconds. The room is waiting.","");

  // Start exactly one countdown interval.
  state.timerId=setInterval(tick,1000);
}

$("startBtn").onclick=reset;
$("restartBtn").onclick=reset;
objects.forEach(o=>o.addEventListener("click",()=>investigate(o.dataset.object)));
updateHud();
