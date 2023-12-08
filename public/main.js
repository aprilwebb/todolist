// function newTask(event) {
//   event.preventDefault();

//   let input = document.getElementById("userInput");

//   let newItem = input.value.trim();

//   if (newItem === "") {
//     alert("You must write something!");
//     return;
//   }

//   let toDoList = document.getElementById("items");

//   let listItem = document.createElement("input");
//   listItem.type = "checkbox";
//   listItem.checked = false;

//   let label = document.createElement("label");
//   label.innerText = newItem;

//   let br = document.createElement("br");

//   toDoList.appendChild(listItem);
//   toDoList.appendChild(label);
//   toDoList.appendChild(br);

//   input.value = "";

//   listItem.addEventListener("change", () => {
//     if (listItem.checked) {
//       label.style.textDecoration = "line-through";
//     } else {
//       label.style.textDecoration = "none";
//     }
//   });
// }

// document.getElementById("addBtn").addEventListener("click", newTask);

// document.getElementById("userInput").addEventListener("keypress", (event) => {
//   if (event.key === "Enter") {
//     event.preventDefault();
//     document.getElementById("addBtn").click();
//   }
// });
