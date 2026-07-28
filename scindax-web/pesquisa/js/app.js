/* ==========================================================
   SCINDAX RESEARCH — IME
   Índice de Maturidade Empresarial

   Application Controller
   Versão Institucional v1.0

   Responsável por:
   - Navegação da pesquisa
   - Integração Supabase
   - IBGE Estados/Cidades
   - ViaCEP
   - Envio das respostas
========================================================== */


document.addEventListener("DOMContentLoaded", () => {


/* ==========================================================
   1. SUPABASE
========================================================== */


const SUPABASE_URL =
"https://mlepylcwaiiatuonaegz.supabase.co";


const SUPABASE_ANON_KEY =
"sb_publishable_lhx5TUzOCF8jp9vMJOr8uQ_yVP9m4jh";


let db = null;


if(
window.supabase &&
SUPABASE_URL &&
SUPABASE_ANON_KEY
){

db = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
);

}



/* ==========================================================
   2. ELEMENTOS
========================================================== */


const welcomeScreen =
document.getElementById("welcome-screen");


const surveyScreen =
document.getElementById("survey-screen");


const thankScreen =
document.getElementById("thank-screen");


const startButton =
document.getElementById("start-btn");


const form =
document.getElementById("survey-form");


const steps =
Array.from(
document.querySelectorAll(".step-card")
);



const btnBack =
document.getElementById("btn-back");


const btnNext =
document.getElementById("btn-next");


const btnSubmit =
document.getElementById("btn-submit");



const progressBar =
document.getElementById("progress-bar");


const stepCounter =
document.getElementById("step-counter");


const stepTitle =
document.getElementById("step-title");



const receiveReport =
document.getElementById("receive-report");


const contactBox =
document.getElementById("contact-box");



const cepInput =
document.getElementById("cep");


const estadoSelect =
document.getElementById("estado");


const cidadeSelect =
document.getElementById("cidade");



const macroArea =
document.getElementById("macro_area");



let currentStep = 0;



const titles = [

"Perfil Profissional",

"Desafios da Gestão",

"Experiência Profissional",

"Perfil Estatístico"

];



/* ==========================================================
   3. INÍCIO
========================================================== */


function iniciarPesquisa(){

welcomeScreen.classList.add("hidden");

surveyScreen.classList.remove("hidden");

currentStep = 0;

mostrarEtapa(currentStep);

carregarEstados();

}



if(startButton){

startButton.addEventListener(
"click",
iniciarPesquisa
);

}



/* ==========================================================
   4. NAVEGAÇÃO
========================================================== */


function mostrarEtapa(index){


steps.forEach((step,i)=>{

step.classList.toggle(
"hidden-step",
i !== index
);


step.classList.toggle(
"active-step",
i === index
);


});


if(stepTitle){

stepTitle.textContent =
titles[index];

}


if(stepCounter){

stepCounter.textContent =
`Etapa ${index+1} de ${steps.length}`;

}


if(progressBar){

progressBar.style.width =
`${((index+1)/steps.length)*100}%`;

}



btnBack?.classList.toggle(
"hidden",
index===0
);


btnNext?.classList.toggle(
"hidden",
index===steps.length-1
);


btnSubmit?.classList.toggle(
"hidden",
index!==steps.length-1
);



window.scrollTo({

top:0,

behavior:"auto"

});


}



function validarEtapa(){


const atual =
steps[currentStep];


const obrigatorios =
atual.querySelectorAll(
"[required]"
);



for(const campo of obrigatorios){


if(!campo.value.trim()){


campo.classList.add(
"input-error"
);


campo.focus();



setTimeout(()=>{

campo.classList.remove(
"input-error"
);

},2000);



return false;


}


}



return true;


}



btnNext?.addEventListener(
"click",
()=>{


if(!validarEtapa())
return;


if(currentStep < steps.length-1){

currentStep++;

mostrarEtapa(currentStep);

}


});



btnBack?.addEventListener(
"click",
()=>{


if(currentStep>0){

currentStep--;

mostrarEtapa(currentStep);

}


});



/* ==========================================================
   5. ÁREA PROFISSIONAL
========================================================== */


document
.querySelectorAll(
'input[name="macro_area_radio"]'
)
.forEach(input=>{


input.addEventListener(
"change",
()=>{


if(macroArea){

macroArea.value =
input.value;

}


});



});



/* ==========================================================
   6. RELATÓRIO
========================================================== */


if(receiveReport && contactBox){


function atualizarContato(){


contactBox.style.display =
receiveReport.checked
?
"grid"
:
"none";


}



receiveReport.addEventListener(
"change",
atualizarContato
);


atualizarContato();


}



/* ==========================================================
   7. IBGE
========================================================== */


async function carregarEstados(){


if(!estadoSelect)
return;



try{


const response =
await fetch(
"https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome"
);


const estados =
await response.json();



estadoSelect.innerHTML =
`<option value="">
Selecione o Estado...
</option>`;



estados.forEach(estado=>{


const option =
document.createElement("option");


option.value =
estado.sigla;


option.textContent =
`${estado.nome} (${estado.sigla})`;


estadoSelect.appendChild(option);


});



}
catch(error){

console.error(
"Erro estados:",
error
);

}



}



async function carregarCidades(uf){


if(!cidadeSelect)
return;



cidadeSelect.disabled =
true;


cidadeSelect.innerHTML =
`
<option>
Carregando cidades...
</option>
`;



try{


const response =
await fetch(

`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`

);



const cidades =
await response.json();



cidadeSelect.innerHTML =
`
<option value="">
Selecione a cidade...
</option>
`;



cidades.forEach(cidade=>{


const option =
document.createElement("option");


option.value =
cidade.nome;


option.textContent =
cidade.nome;


cidadeSelect.appendChild(option);


});


cidadeSelect.disabled =
false;



}
catch(error){

console.error(
"Erro cidades:",
error
);

}



}



estadoSelect?.addEventListener(
"change",
event=>{


carregarCidades(
event.target.value
);


});



/* ==========================================================
   8. CEP
========================================================== */


cepInput?.addEventListener(
"blur",
async ()=>{


const cep =
cepInput.value
.replace(/\D/g,"");


if(cep.length!==8)
return;



try{


const response =
await fetch(
`https://viacep.com.br/ws/${cep}/json/`
);



const data =
await response.json();



if(data.erro)
return;



estadoSelect.value =
data.uf;


await carregarCidades(
data.uf
);



cidadeSelect.value =
data.localidade;



}
catch(error){

console.error(
"Erro CEP:",
error
);


}



});



/* ==========================================================
   9. ENVIO SUPABASE
========================================================== */


form?.addEventListener(
"submit",
async event=>{


event.preventDefault();



if(!validarEtapa())
return;



btnSubmit.disabled =
true;



const dados =
new FormData(form);



const desafios =
Array.from(

document.querySelectorAll(
'input[name="desafios"]:checked'
)

)
.map(item=>item.value);



const payload = {


macro_area:
dados.get("macro_area"),


especialidade:
dados.get("especialidade"),


tempo_mercado:
dados.get("tempo_mercado"),


formato_negocio:
dados.get("formato_negocio"),


desafios,


organizacao:
dados.get("organizacao"),


conquista:
dados.get("conquista"),


melhoria:
dados.get("melhoria"),


cidade:
dados.get("cidade"),


estado:
dados.get("estado"),


genero:
dados.get("genero"),


raca:
dados.get("raca"),


deseja_relatorio:
receiveReport?.checked ?? false,


contato_nome:
dados.get("nome"),


contato:
dados.get("contato"),


navegador:
navigator.userAgent,


largura_tela:
window.innerWidth,


altura_tela:
window.innerHeight,


data_resposta:
new Date().toISOString()


};



try{


if(db){


const {

error

}
=
await db

.from("ime_respostas")

.insert([payload]);



if(error)
throw error;



}



surveyScreen.classList.add(
"hidden"
);


thankScreen.classList.remove(
"hidden"
);



window.scrollTo({

top:0,

behavior:"auto"

});



}
catch(error){


console.error(
error
);


alert(
"Não foi possível enviar sua resposta. Tente novamente."
);



btnSubmit.disabled =
false;


}



});



});