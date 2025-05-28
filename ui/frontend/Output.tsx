import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { changeFocus } from './reducers/output/meta';
import { State } from './reducers';
import { Focus } from './types';

import Execute from './Output/Execute';
import Gist from './Output/Gist';
import Section from './Output/Section';
import SimplePane, { SimplePaneProps } from './Output/SimplePane';
import PaneWithMir from './Output/PaneWithMir';
import * as selectors from './selectors';

import styles from './Output.module.css';
import Stdin from './Stdin';

const Tab: React.FC<TabProps> = ({ kind, focus, label, onClick, tabProps }) => {
  if (selectors.hasProperties(tabProps)) {
    return (
      <button className={focus === kind ? styles.tabSelected : styles.tab}
        onClick={onClick}>
        {label}
      </button>
    );
  } else {
    return null;
  }
};

interface TabProps {
  kind: Focus;
  focus?: Focus;
  label: string;
  onClick: () => any;
  tabProps: object;
}

const PaneWithCode: React.FC<PaneWithCodeProps> = ({ code, ...rest }) => (
  <SimplePane {...rest}>
    <Section kind="code" label="Result">{code}</Section>
  </SimplePane>
);

interface PaneWithCodeProps extends SimplePaneProps {
  code?: string;
}

const Output: React.FC = () => {
  const somethingToShow = useSelector(selectors.getSomethingToShow);
  const { meta: { focus }, execute, format, clippy, miri, macroExpansion, assembly, llvmIr, mir, hir, wasm, gist } =
    useSelector((state: State) => state.output);

  const dispatch = useDispatch();
  const focusClose = useCallback(() => dispatch(changeFocus()), [dispatch]);
  const focusExecute = useCallback(() => dispatch(changeFocus(Focus.Execute)), [dispatch]);
  const focusFormat = useCallback(() => dispatch(changeFocus(Focus.Format)), [dispatch]);
  const focusClippy = useCallback(() => dispatch(changeFocus(Focus.Clippy)), [dispatch]);
  const focusMiri = useCallback(() => dispatch(changeFocus(Focus.Miri)), [dispatch]);
  const focusMacroExpansion = useCallback(() => dispatch(changeFocus(Focus.MacroExpansion)), [dispatch]);
  const focusAssembly = useCallback(() => dispatch(changeFocus(Focus.Asm)), [dispatch]);
  const focusLlvmIr = useCallback(() => dispatch(changeFocus(Focus.LlvmIr)), [dispatch]);
  const focusMir = useCallback(() => dispatch(changeFocus(Focus.Mir)), [dispatch]);
  const focusHir = useCallback(() => dispatch(changeFocus(Focus.Hir)), [dispatch]);
  const focusWasm = useCallback(() => dispatch(changeFocus(Focus.Wasm)), [dispatch]);
  const focusGist = useCallback(() => dispatch(changeFocus(Focus.Gist)), [dispatch]);

  const showStdin = useSelector(selectors.showStdinSelector);

  if (!somethingToShow) {
    return null;
  }

  let close: React.ReactElement | null = null;
  let body: React.ReactElement | null = null;
  if (focus) {
    close = <button className={styles.tabClose} onClick={focusClose}>Close</button>;

    body = (
      <>
        <div className={styles.body}>
          {focus === Focus.Execute && <Execute />}
          {focus === Focus.Format && <SimplePane {...format} kind="format" />}
          {focus === Focus.Clippy && <SimplePane {...clippy} kind="clippy" />}
          {focus === Focus.Miri && <SimplePane {...miri} kind="miri" />}
          {focus === Focus.MacroExpansion && <SimplePane {...macroExpansion} kind="macro-expansion" />}
          {focus === Focus.Asm && <PaneWithCode {...assembly} kind="asm" />}
          {focus === Focus.LlvmIr && <PaneWithCode {...llvmIr} kind="llvm-ir" />}
          {focus === Focus.Mir && <PaneWithMir {...mir} kind="mir" />}
          {focus === Focus.Hir && <PaneWithMir {...hir} kind="hir" />}
          {focus === Focus.Wasm && <PaneWithCode {...wasm} kind="wasm" />}
          {focus === Focus.Gist && <Gist />}
        </div>
        {showStdin && (
          <div className={styles.stdin}>
            <Stdin />
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.container} data-test-id="output">
      <div className={styles.tabs}>
        <Tab kind={Focus.Execute} focus={focus}
          label="Execution"
          onClick={focusExecute}
          tabProps={execute} />
        <Tab kind={Focus.Format} focus={focus}
          label="Format"
          onClick={focusFormat}
          tabProps={format} />
        <Tab kind={Focus.Clippy} focus={focus}
          label="Clippy"
          onClick={focusClippy}
          tabProps={clippy} />
        <Tab kind={Focus.Miri} focus={focus}
          label="Miri"
          onClick={focusMiri}
          tabProps={miri} />
        <Tab kind={Focus.MacroExpansion} focus={focus}
          label="Macro expansion"
          onClick={focusMacroExpansion}
          tabProps={macroExpansion} />
        <Tab kind={Focus.Asm} focus={focus}
          label="ASM"
          onClick={focusAssembly}
          tabProps={assembly} />
        <Tab kind={Focus.LlvmIr} focus={focus}
          label="LLVM IR"
          onClick={focusLlvmIr}
          tabProps={llvmIr} />
        <Tab kind={Focus.Mir} focus={focus}
          label="MIR"
          onClick={focusMir}
          tabProps={mir} />
        <Tab kind={Focus.Hir} focus={focus}
          label="HIR"
          onClick={focusHir}
          tabProps={hir} />
        <Tab kind={Focus.Wasm} focus={focus}
          label="Wasm"
          onClick={focusWasm}
          tabProps={wasm} />
        <Tab kind={Focus.Gist} focus={focus}
          label="Share"
          onClick={focusGist}
          tabProps={gist} />
        {close}
      </div>
      { body }
    </div>
  );
};

export default Output;
