import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { Draft } from 'immer';

import { ActionType } from '../../actions';
import { Focus } from '../../types';
import { performCompileAssembly } from './assembly';
import { performExecute, wsExecuteRequest } from './execute';
import { performFormat } from './format';
import { performGistLoad, performGistSave } from './gist';
import { performCompileHir } from './hir';
import { performCompileLlvmIr } from './llvmIr';
import { performCompileMir } from './mir';
import { performCompileWasm } from './wasm';

const initialState: State = {};

interface State {
  focus?: Focus;
}

function setExecute(state: Draft<State>) {
  state.focus = Focus.Execute;
}
function setGist(state: Draft<State>) {
  state.focus = Focus.Gist;
}

const slice = createSlice({
  name: 'output/meta',
  initialState,
  reducers: {
    changeFocus: (state, action: PayloadAction<Focus | undefined>) => {
      state.focus = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(ActionType.RequestClippy, (state) => {
        state.focus = Focus.Clippy;
      })

      .addCase(ActionType.RequestMiri, (state) => {
        state.focus = Focus.Miri;
      })

      .addCase(ActionType.RequestMacroExpansion, (state) => {
        state.focus = Focus.MacroExpansion;
      })

      .addCase(performExecute.pending, setExecute)
      .addCase(wsExecuteRequest, setExecute)

      .addCase(performCompileAssembly.pending, (state) => {
        state.focus = Focus.Asm;
      })

      .addCase(performCompileHir.pending, (state) => {
        state.focus = Focus.Hir;
      })

      .addCase(performCompileLlvmIr.pending, (state) => {
        state.focus = Focus.LlvmIr;
      })

      .addCase(performCompileMir.pending, (state) => {
        state.focus = Focus.Mir;
      })

      .addCase(performCompileWasm.pending, (state) => {
        state.focus = Focus.Wasm;
      })

      .addCase(performFormat.pending, (state) => {
        state.focus = Focus.Format;
      })

      .addCase(performFormat.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.focus = undefined;
        }
      })

      .addCase(performGistLoad.pending, setGist)
      .addCase(performGistSave.pending, setGist);
  },
});

export const { changeFocus } = slice.actions;

export default slice.reducer;
