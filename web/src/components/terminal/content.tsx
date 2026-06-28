import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useEffect, useRef, useState } from "react";
import type { Observable } from "rxjs";
import { RemoteProcess } from '../../api/api';
import React from 'react';

function createTerminalInstance() {
    return new Terminal({ disableStdin: true, convertEol: true, cursorStyle: "underline", scrollback: RemoteProcess.MAX_OUTPUT_HISTORY });
}

function useXterm() {
    const [instance, setInstance] = useState<Terminal|null>(null);
    const autoFit = useRef<FitAddon>(null);
    const elementRef = useRef<HTMLDivElement>(null);
    const resizeObserver = useRef<ResizeObserver>(null);

    if (autoFit.current === null) {
        autoFit.current = new FitAddon();
    }

    useEffect(() => {
        const terminal = createTerminalInstance();
        terminal.write(`\x1b[?25l`);
        terminal.loadAddon(autoFit.current!);
        if (resizeObserver.current === null) {
            resizeObserver.current = new ResizeObserver(() => {
                autoFit.current?.fit();
            });
        }
        if (elementRef.current) {
            terminal.open(elementRef.current);
            resizeObserver.current.observe(elementRef.current);
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInstance(() => terminal);
        return () => {
            console.log("disposed");
            terminal.dispose();
            setInstance(() => null);
            resizeObserver.current?.disconnect();
        };
    }, []);

    return {
        instance,
        ref: elementRef
    }
}

export default function TerminalScreen(props: TerminalScreenProps) {
    const { instance, ref } = useXterm();

    useEffect(() => {
        if (props.value) {
            instance?.reset();
            instance?.write(props.value);
        }
    }, [props.value, instance]);

    useEffect(() => {
        if (props.stream == undefined) {
            return;
        }
        instance?.reset();
        const sub = props.stream.subscribe({
            next(value) {
                instance?.write(value);
            }
        });
        return () => {
            sub.unsubscribe();
        }
    }, [props.stream, instance]);

    return (
        <div
            id="terminalContent"
            ref={ref}
            style={{
                height: "100%",
                minHeight: 250
            }}
        />
    );
}

interface TerminalScreenProps {
    value?: string | null,
    stream?: Observable<string>
}