import moment, { type Moment, type unitOfTime } from 'moment';
import { Task } from '../Task';
import { TasksDate } from './TasksDate';

export function shouldShowPostponeButton(task: Task) {
    const hasAValidHappensDate = task.happensDates.some((date) => {
        return !!date?.isValid();
    });

    return !task.isDone && hasAValidHappensDate;
}

export type HappensDate = keyof Pick<Task, 'startDate' | 'scheduledDate' | 'dueDate'>;

/**
 * Gets a {@link HappensDate} field from a {@link Task} with the following priority: due > scheduled > start.
 * If the task has no happens field {@link HappensDate}, null is returned.
 *
 * @param task
 */
export function getDateFieldToPostpone(task: Task): HappensDate | null {
    if (task.dueDate) {
        return 'dueDate';
    }

    if (task.scheduledDate) {
        return 'scheduledDate';
    }

    if (task.startDate) {
        return 'startDate';
    }

    return null;
}

export function createPostponedTask(
    task: Task,
    dateFieldToPostpone: HappensDate,
    timeUnit: unitOfTime.DurationConstructor,
    amount: number,
) {
    const dateToPostpone = task[dateFieldToPostpone];
    const postponedDate = new TasksDate(dateToPostpone).postpone(timeUnit, amount);
    const postponedTask = new Task({ ...task, [dateFieldToPostpone]: postponedDate });
    return { postponedDate, postponedTask };
}

export function postponementSuccessMessage(postponedDate: Moment, dateFieldToPostpone: HappensDate) {
    // TODO all logic for invalid dates
    const postponedDateString = postponedDate?.format('DD MMM YYYY');
    return `Task's ${dateFieldToPostpone} postponed until ${postponedDateString}`;
}

export function postponeButtonTitle(task: Task, amount: number, timeUnit: unitOfTime.DurationConstructor) {
    const buttonText = postponeMenuItemTitle(task, amount, timeUnit);
    return `ℹ️ ${buttonText} (right-click for more options)`;
}

export function postponeMenuItemTitle(task: Task, amount: number, timeUnit: unitOfTime.DurationConstructor) {
    function capitalizeFirstLetter(word: string) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }
    const updatedDateType = getDateFieldToPostpone(task)!;
    const dateToUpdate = task[updatedDateType] as Moment;
    if (dateToUpdate.isSameOrBefore(moment(), 'day')) {
        const updatedDateDisplayText = capitalizeFirstLetter(updatedDateType.replace('Date', ''));

        const postponedDate = new TasksDate(dateToUpdate).postpone(timeUnit, amount);
        const formattedNewDate = postponedDate.format('ddd Do MMM');

        const amountOrArticle = amount > 1 ? amount : 'a';
        return `${updatedDateDisplayText} in ${amountOrArticle} ${timeUnit}, on ${formattedNewDate}`;
    } else {
        const updatedDateDisplayText = updatedDateType.replace('Date', ' date');
        const amountOrArticle = amount > 1 ? amount : 'a';

        const postponedDate = new TasksDate(dateToUpdate).postpone(timeUnit, amount);
        const formattedNewDate = postponedDate.format('ddd Do MMM');
        // 'Postpone due date by a day, to Tue 5th Dec')
        return `Postpone ${updatedDateDisplayText} by ${amountOrArticle} ${timeUnit}, to ${formattedNewDate}`;
    }
}
