<script setup lang="ts">
import { ref } from "vue";
import { useDragAndDrop } from "fluid-dnd/vue";

const list = ref([1, 2, 3, 4, 5]);
const [ parent1 ] = useDragAndDrop<number>(list, {
  droppableGroup: "group1",
  droppableClass: 'droppable-hover'
});

const list2 = ref([6, 7, 8, 9, 10]);
const [ parent2 ] = useDragAndDrop<number>(list2, {
  droppableGroup: "group1",
  direction: "horizontal",
  droppableClass: 'droppable-hover'
});
</script>
<template>
  <div class="group-list bg-[var(--sl-color-gray-6)]">
    <ul ref="parent1" class="number-list">
      <li class="number" v-for="(element, index) in list" :index :key="element">
        {{ element }}
      </li>
    </ul>
    <div ref="parent2" class="number-list-h">
      <div
        class="number"
        v-for="(element, index) in list2"
        :index
        :key="element"
      >
        {{ element }}
      </div>
    </div>
  </div>
</template>

<style>
.number {
  border-style: solid;
  padding-left: 10px;
  padding-block: 5px;
  margin-top: 0.25rem !important;
  border-width: 2px;
  border-color: var(--sl-color-gray-1);
  color: var(--sl-color-gray-2);
  min-width: 120px;
  width: 120px;
}

.number-list {
  display: block;
  height: 290px;
  overflow-y: auto;
  background-color: var(--sl-color-gray-5);
  padding: 1.5rem;
  transition: background-color 150ms ease-in;
}
.number-list.droppable-hover{
  background-color: var(--sl-color-gray-4);
}
.number-list-h {
  overflow-x: auto;
  display: flex;
  flex-direction: row;
  padding-inline: 25px;
  margin-top: 0 !important;
  padding: 1.5rem;
  transition: background-color 150ms ease-in;
}
.number-list-h.droppable-hover{
  background-color: var(--sl-color-gray-4);
}
.temp-child {
  margin-top: 0 !important;
}
</style>
