import {
    Decoration,
    DecorationSet,
    EditorView,
    MatchDecorator,
    PluginSpec,
    PluginValue,
    ViewPlugin,
    ViewUpdate,
    WidgetType
} from "@codemirror/view";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import InlinePomodoroPlugin from "../InlinePomodoroIndex";
import ReactDOM from 'react-dom/client';
import React, { StrictMode } from "react";
import TimeCircleProgressbar from "@/ui/TimeCircleProgressbar";
import { Transaction } from "@codemirror/state";

interface DecoSpec {
    widget?: InlineTimerWidget;
}

class InlineTimerWidget extends WidgetType {
    public error = false;
    private currentEnd: string;
    private repeatTime: number;
    private currentDuration: string;
    private root: ReactDOM.Root;

    private span: HTMLSpanElement;

    constructor(
        public readonly view: EditorView,
        public readonly plugin: InlinePomodoroPlugin,
        public readonly timeRange: {
            end: string,
            duration: string,
            repeat: string,
        },
        public readonly textRange: {
            from: number,
            to: number,
        },
    ) {
        super();
        this.currentEnd = timeRange.end;
        this.repeatTime = parseInt(timeRange.repeat || '1');
        this.currentDuration = timeRange.duration;

        this.span = createSpan();
        this.root = ReactDOM.createRoot(this.span);
    }

    eq(widget: InlineTimerWidget): boolean {
        // console.log(this.currentEnd, widget.currentEnd, this.textRange.from, widget.textRange.from);
        return widget.currentEnd === this.currentEnd && widget.currentDuration === this.currentDuration;
    }

    updateTime(end: string, duration: string, type: 'repeat' | 'restart') {
        this.currentEnd = end;
        this.currentDuration = duration;
        const timerCurrentLine = this.view.state.doc.lineAt(this.textRange.from);
        const lineFrom = timerCurrentLine.from;
        const startIndex = this.textRange.from - lineFrom;

        const firstMarkIndex = timerCurrentLine.text.lastIndexOf('%%', startIndex + 4);
        const nextMarkIndex = timerCurrentLine.text.indexOf('%%', startIndex + 4);
        this.repeatTime = parseInt(timerCurrentLine.text.slice(firstMarkIndex + 2, nextMarkIndex).match(/time(\d*)?:/)?.[1] || '1');

        this.view.dispatch({
            changes: {
                from: firstMarkIndex === -1 ? this.textRange.from : (timerCurrentLine.from + firstMarkIndex),
                to: nextMarkIndex === -1 ? this.textRange.to : (timerCurrentLine.from + nextMarkIndex + 2),
                insert: `%% time${type === 'repeat' ? (this.repeatTime ? this.repeatTime + 1 : 2) : (this.repeatTime ? this.repeatTime : 1)}:${end}+${duration} %%`,
            },
            annotations: Transaction.userEvent.of("plugin-update")
        });

    }

    toDOM(): HTMLElement {
        this.root = ReactDOM.createRoot(this.span);
        this.root.render(
            <StrictMode>
                <TimeCircleProgressbar
                    markdownInfo={this.view.state.field(editorInfoField)}
                    plugin={this.plugin}
                    endTime={this.timeRange.end}
                    elapsedTime={this.timeRange.duration}
                    repeat={this.timeRange.repeat || '1'}
                    update={(end, duration, type) => {
                        this.updateTime(end, duration, type);
                    }}
                />
            </StrictMode>);

        return this.span;
    }

    destroy(dom: HTMLElement) {
        super.destroy(dom);

        this.root?.unmount();
        const intervalRef = dom.find('.cm-inline-pomodoro-timer')?.getAttribute('data-interval-ref');
        if (intervalRef) {
            window.clearInterval(parseInt(intervalRef));
        }
    }
}

export function createInlinePomodoroPlugin(_plugin: InlinePomodoroPlugin) {
    class InlineViewPluginValue implements PluginValue {
        public readonly view: EditorView;
        private readonly match = new MatchDecorator({
            regexp: /%%\s*?time(\d*)?:(\d{10})(\+(\d{1,4}))?\s*?%%/g,
            decorate: (add, from: number, to: number, match: RegExpExecArray, view: EditorView) => {
                // console.log('decorate', view);
                const shouldRender = this.shouldRender(view, from, to);
                if (shouldRender) {
                    add(
                        from,
                        to,
                        Decoration.replace({
                            widget: new InlineTimerWidget(view, _plugin, {
                                end: match[2],
                                duration: match[4],
                                repeat: match[1],
                            }, {
                                from,
                                to,
                            }),
                        }),
                    );
                }
            },
        });
        decorations: DecorationSet = Decoration.none;

        constructor(view: EditorView) {
            this.view = view;
            this.updateDecorations(view);
        }

        update(update: ViewUpdate): void {
            this.updateDecorations(update.view, update);
        }

        destroy(): void {
            this.decorations = Decoration.none;
        }

        updateDecorations(view: EditorView, update?: ViewUpdate) {
            // console.log('update decorations', update);
            if (!update || this.decorations.size === 0) {
                this.decorations = this.match.createDeco(view);
            } else {
                // if (update.transactions.find((t) => t.annotation(Transaction.userEvent) === 'plugin-update')) {
                //     return;
                // }
                this.decorations = this.match.updateDeco(update, this.decorations);
            }
        }

        isLivePreview(state: EditorView["state"]): boolean {
            return state.field(editorLivePreviewField);
        }

        shouldRender(view: EditorView, decorationFrom: number, decorationTo: number) {
            const overlap = view.state.selection.ranges.some((r) => {
                if (r.from <= decorationFrom) {
                    return r.to >= decorationFrom;
                } else {
                    return r.from <= decorationTo;
                }
            });
            return !overlap && this.isLivePreview(view.state);
        }
    }

    const InlineViewPluginSpec: PluginSpec<InlineViewPluginValue> = {
        decorations: (plugin) => {
            // Update and return decorations for the CodeMirror view

            return plugin.decorations.update({
                filter: (rangeFrom: number, rangeTo: number, deco: Decoration) => {
                    const widget = (deco.spec as DecoSpec).widget;
                    if (widget && widget.error) {
                        console.log("GOT WIDGET ERROR");
                        return false;
                    }
                    // Check if the range is collapsed (cursor position)
                    return (
                        rangeFrom === rangeTo ||
                        // Check if there are no overlapping selection ranges
                        !plugin.view.state.selection.ranges.filter((selectionRange: { from: number; to: number; }) => {
                            // Determine the start and end positions of the selection range
                            const selectionStart = selectionRange.from;
                            const selectionEnd = selectionRange.to;

                            // Check if the selection range overlaps with the specified range
                            if (selectionStart <= rangeFrom) {
                                return selectionEnd >= rangeFrom; // Overlapping condition
                            } else {
                                return selectionStart <= rangeTo; // Overlapping condition
                            }
                        }).length
                    );
                },
            });
        },
    };

    return ViewPlugin.fromClass(InlineViewPluginValue, InlineViewPluginSpec);
}
