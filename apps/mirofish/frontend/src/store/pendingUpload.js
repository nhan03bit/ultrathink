/**
 * Temporarily stores files and requirements pending upload.
 * Used to immediately navigate after clicking "Launch Engine" on the home page,
 * then perform the actual API call on the Process page.
 */
import { reactive } from "vue";

const state = reactive({
  files: [],
  simulationRequirement: "",
  isPending: false,
});

export function setPendingUpload(files, requirement) {
  state.files = files;
  state.simulationRequirement = requirement;
  state.isPending = true;
}

export function getPendingUpload() {
  return {
    files: state.files,
    simulationRequirement: state.simulationRequirement,
    isPending: state.isPending,
  };
}

export function clearPendingUpload() {
  state.files = [];
  state.simulationRequirement = "";
  state.isPending = false;
}

export default state;
