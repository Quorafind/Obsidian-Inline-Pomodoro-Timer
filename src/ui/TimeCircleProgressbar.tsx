import '@/less/TimeCircleProgressbar.less';
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import { MarkdownFileInfo, MarkdownView, Menu, moment, setTooltip } from "obsidian";
import { useEffect, useRef, useState } from "react";
import React from 'react';
import InlinePomodoroPlugin from "@/InlinePomodoroIndex";
import { useHover } from "@/hook/useHover";

interface Props {

    plugin: InlinePomodoroPlugin;
    markdownInfo: MarkdownFileInfo;
    endTime: string;
    elapsedTime: string;
    repeat: string;
    update: (endTime: string, elapsedTime: string, type: 'repeat' | 'restart') => void;
}

export const POMODORO_DURATION = 25 * 60;

export const TimeCircleProgressbar: React.FC<Props> = ({
                                                           markdownInfo,
                                                           plugin,
                                                           endTime,
                                                           elapsedTime,
                                                           repeat,
                                                           update,
                                                       }) => {
    const [endTimeState, setEndTimeState] = useState(parseInt(endTime));
    const [currentTime, setCurrentTime] = useState(parseInt(moment().format('X')));
    const [isPaused, setIsPaused] = useState(parseInt(elapsedTime) > 0);
    const [elapsedTimeState, setElapsedTimeState] = useState(parseInt(elapsedTime));
    const [repeatTime, setRepeatTime] = useState(parseInt(repeat));

    const [percentage, setPercentage] = useState(0);

    const intervalRef = React.useRef<number>();

    const hoverRef = useRef<HTMLSpanElement>(null);
    const progressBarRef = useRef<HTMLSpanElement>(null);
    const isHover = useHover(hoverRef);

    useEffect(() => {
        if (progressBarRef.current) {
            setTooltip && setTooltip(progressBarRef.current, `Repeat ${repeatTime} times. Click to start or pause`);
        }
    }, [repeatTime, progressBarRef]);


    useEffect(() => {


        if (isPaused || intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }

        const loadTime = () => {

            intervalRef.current = window.setInterval(() => {
                if (currentTime >= endTimeState) {
                    window.clearInterval(intervalRef.current);
                    return;
                }
                console.log('set current time');
                setCurrentTime(parseInt(moment().format('X')));
            }, 1000);
            (markdownInfo as MarkdownView).registerInterval(intervalRef.current);
            plugin.registerInterval(intervalRef.current);
        };

        loadTime();
        return () => {
            console.log('clear interval');
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [isPaused, endTimeState]);

    useEffect(() => {
        if (parseInt(elapsedTime) > 0) {
            const realEndTime = moment().add(POMODORO_DURATION > parseInt(elapsedTime) ? POMODORO_DURATION - parseInt(elapsedTime) : POMODORO_DURATION, 'seconds').format('X');
            const timeLeft = parseInt(realEndTime) - currentTime;
            const perc = (timeLeft / POMODORO_DURATION) * 100;
            setPercentage(perc);
        }

    }, [elapsedTime]);

    useEffect(() => {
        if (isPaused) {
            return;
        }

        updatePercentage();
    }, [currentTime, endTimeState, isPaused, elapsedTimeState]);

    const updatePercentage = () => {
        const timeLeft = (endTimeState - currentTime - (isPaused ? elapsedTimeState : 0));
        const perc = (timeLeft / POMODORO_DURATION) * 100;
        setPercentage(perc);
    };

    const handleClick = () => {
        if (isPaused) {
            const newEndTime = parseInt(moment().add(POMODORO_DURATION > elapsedTimeState ? POMODORO_DURATION - elapsedTimeState : POMODORO_DURATION, 'seconds').format('X'));
            setEndTimeState(newEndTime);
            setCurrentTime(parseInt(moment().format('X')));
            setIsPaused(false);
            update(newEndTime.toString(), '0', 'restart');
            return;
        }


        if (currentTime >= endTimeState) {
            setCurrentTime(parseInt(moment().format('X')));
            const newEndTime = parseInt(moment().add(POMODORO_DURATION, 'seconds').format('X'));
            setEndTimeState(newEndTime);
            update(newEndTime.toString(), '0', 'repeat');
            setRepeatTime((r) => r + 1);
            return;
        }
        setIsPaused(true);
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;

        const elapsedTime = POMODORO_DURATION - (endTimeState - currentTime);
        setElapsedTimeState(elapsedTime);
        update(endTimeState.toString(), elapsedTime.toString(), 'restart');


    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const menu = new Menu();
        isPaused && menu.addItem((item) => {
            item.setIcon('play').setTitle('Start pomodoro').onClick(() => {
                handleClick();
            });
        });

        !isPaused && currentTime < endTimeState && menu.addItem((item) => {
            item.setIcon('pause').setTitle('Pause pomodoro').onClick(() => {
                handleClick();
            });
        });


        menu.addItem((item) => {
            item.setIcon('rotate-cw').setTitle('Restart pomodoro').onClick(() => {
                const newEndTime = parseInt(moment().add(POMODORO_DURATION, 'seconds').format('X'));
                setEndTimeState(newEndTime);
                setCurrentTime(parseInt(moment().format('X')));
                setIsPaused(false);
                update(newEndTime.toString(), '0', 'restart');
            });
        });

        menu.showAtMouseEvent(e.nativeEvent);
    };


    return (
        <span ref={progressBarRef} data-interval-ref={intervalRef.current} className={'cm-inline-pomodoro-timer'}
              onClick={handleClick} onContextMenuCapture={handleContextMenu}>
            <span className={'inline-progress-bar'}>
                <CircularProgressbar
                    value={percentage}
                    strokeWidth={50}
                    styles={buildStyles({
                        strokeLinecap: "butt",
                    })}
                />
            </span>
            <span ref={hoverRef} className={'time-text'}>
            {
                currentTime >= endTimeState && !isPaused ? <>
                    {isHover ? 'Restart' : 'Done'}
                </> : isPaused ? <>
                        {'Paused'}
                    </> :
                    moment((endTimeState - currentTime) * 1000).format('mm:ss')
            }
            </span>

        </span>
    );
};


export default TimeCircleProgressbar;
