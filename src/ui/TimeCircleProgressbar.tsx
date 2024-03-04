import '@/less/TimeCircleProgressbar.less';
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import {
    MarkdownFileInfo,
    MarkdownView,
    Menu,
    moment, Notice, requestUrl,
    RequestUrlParam,
    RequestUrlResponsePromise,
    setTooltip
} from "obsidian";
import { useEffect, useRef, useState } from "react";
import React from 'react';
import InlinePomodoroPlugin from "@/InlinePomodoroIndex";
import { useHover } from "@/hook/useHover";

interface Props {
    plugin: InlinePomodoroPlugin;
    markdownInfo: MarkdownFileInfo;
    timeInfo: {
        endTime: string;
        elapsedTime: string;
        repeat: string;
    };
    textInfo: {
        text: string;
    };
    update: (endTime: string, elapsedTime: string, type: 'repeat' | 'restart') => void;
}

export const getDuration = (plugin: InlinePomodoroPlugin) => {
    const duration = plugin.settings.pomodoroMinutes * 60;
    return duration || 25 * 60;
};

export function sendNotification(plugin: InlinePomodoroPlugin, title: string, desp?: string, short?: string, noip?: number, openid?: string): RequestUrlResponsePromise {
    if (!plugin.settings.secretKey) {
        new Notice('Please set the secret key in the settings');
        return;
    }

    const apiUrl = `https://sctapi.ftqq.com/${plugin.settings.secretKey}.send`;
    const method = 'POST';
    const contentType = 'application/json;charset=utf-8';

    // 构造请求体
    const body = JSON.stringify({
        title: title,
        desp: desp,
        short: short,
        noip: noip,
        channel: '9|98',
        openid: openid
    });

    // 构造请求参数
    const requestParams: RequestUrlParam = {
        url: apiUrl,
        method: method,
        contentType: contentType,
        body: body,
        headers: {
            'Content-Type': contentType
        }
    };

    return requestUrl(requestParams);
}

export const TimeCircleProgressbar: React.FC<Props> = ({
                                                           markdownInfo,
                                                           plugin,
                                                           timeInfo,
                                                           textInfo,
                                                           update,
                                                       }) => {
    const {
        endTime,
        elapsedTime,
        repeat
    } = timeInfo;

    const {text} = textInfo;

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
        if (currentTime >= endTimeState) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }

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
                setCurrentTime(parseInt(moment().format('X')));
            }, 1000);
            (markdownInfo as MarkdownView).registerInterval(intervalRef.current);
            plugin.registerInterval(intervalRef.current);
        };

        loadTime();
        return () => {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [isPaused, endTimeState]);

    useEffect(() => {
        if (parseInt(elapsedTime) > 0) {
            const realEndTime = moment().add(getDuration(plugin) > parseInt(elapsedTime) ? getDuration(plugin) - parseInt(elapsedTime) : getDuration(plugin), 'seconds').format('X');
            const timeLeft = parseInt(realEndTime) - currentTime;
            const perc = (timeLeft / getDuration(plugin)) * 100;
            setPercentage(perc);
        }

    }, [elapsedTime]);

    useEffect(() => {
        if (isPaused) {
            return;
        }

        updatePercentage();
    }, [currentTime, endTimeState, isPaused, elapsedTimeState]);

    useEffect(() => {
        if (!intervalRef.current) return;
        if (currentTime < endTimeState) return;

        if (currentTime >= endTimeState && !isPaused && elapsedTimeState === 0) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
            plugin.settings.pushNotification && sendNotification(plugin, text.slice(0, 10), text, `Pomodoro done ${repeatTime} times`);
        }
    }, [currentTime]);

    const updatePercentage = () => {
        const timeLeft = (endTimeState - currentTime - (isPaused ? elapsedTimeState : 0));
        const perc = (timeLeft / getDuration(plugin)) * 100;
        setPercentage(perc);
    };

    const handleClick = () => {
        if (isPaused) {
            const newEndTime = parseInt(moment().add(getDuration(plugin) > elapsedTimeState ? getDuration(plugin) - elapsedTimeState : getDuration(plugin), 'seconds').format('X'));
            setEndTimeState(newEndTime);
            setCurrentTime(parseInt(moment().format('X')));
            setIsPaused(false);
            update(newEndTime.toString(), '0', 'restart');
            return;
        }


        if (currentTime >= endTimeState) {
            setCurrentTime(parseInt(moment().format('X')));
            const newEndTime = parseInt(moment().add(getDuration(plugin), 'seconds').format('X'));
            setEndTimeState(newEndTime);
            update(newEndTime.toString(), '0', 'repeat');
            setRepeatTime((r) => r + 1);
            return;
        }
        setIsPaused(true);
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;

        const elapsedTime = getDuration(plugin) - (endTimeState - currentTime);
        setElapsedTimeState(elapsedTime);
        update(endTimeState.toString(), elapsedTime.toString(), 'restart');
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const menu = new Menu();
        isPaused && menu.addItem((item) => {
            item.setIcon('play').setTitle('Start').onClick(() => {
                handleClick();
            });
        });

        !isPaused && currentTime < endTimeState && menu.addItem((item) => {
            item.setIcon('pause').setTitle('Pause').onClick(() => {
                handleClick();
            });
        });


        menu.addItem((item) => {
            item.setIcon('rotate-cw').setTitle('Restart').onClick(() => {
                const newEndTime = parseInt(moment().add(getDuration(plugin), 'seconds').format('X'));
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
