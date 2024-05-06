/**
 * @jest-environment jsdom
 */
import moment from 'moment';
import { verifyAll } from 'approvals/lib/Providers/Jest/JestApprovals';
import { RecurrenceBuilder } from '../TestingTools/RecurrenceBuilder';
import { Status } from '../../src/Statuses/Status';
import { StatusConfiguration, StatusType } from '../../src/Statuses/StatusConfiguration';
import { TaskBuilder } from '../TestingTools/TaskBuilder';
import { fromLine, toLines, toMarkdown } from '../TestingTools/TestHelpers';
import type { Task } from '../../src/Task/Task';
import { handleOnCompletion } from '../../src/Task/OnCompletion';
import { writeLineToListEnd } from '../../src/Task/OnCompletion';
import { prepareTaskLineForArchiving, removeBlockQuoteCalloutPrefixes } from '../../src/Task/OnCompletion';

window.moment = moment;

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-02-11'));
});

afterEach(() => {
    jest.useRealTimers();
    // resetSettings();
});

export function applyStatusAndOnCompletionAction(task: Task, newStatus: Status) {
    const tasks = task.handleNewStatus(newStatus);
    function testFileWriter(_filePath: string, _fileContentUpdater: (data: string) => string): void {
        // updateFileContent(filePath, fileContentUpdater).then(() => {});
    }
    return handleOnCompletion(task, tasks, 'archive.md', testFileWriter);
}

describe('OnCompletion - tasks to return without taking any action', () => {
    it('should just return task if Action is not recognized', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const task = new TaskBuilder()
            .description('A non-recurring task with invalid OC trigger 🏁 INVALID_ACTION')
            .dueDate(dueDate)
            .build();
        expect(task.status.type).toEqual(StatusType.TODO);

        // Act
        const returnedTasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(returnedTasks.length).toEqual(1);
        expect(toLines(returnedTasks).join('\n')).toMatchInlineSnapshot(
            '"- [x] A non-recurring task with invalid OC trigger 🏁 INVALID_ACTION 📅 2024-02-10 ✅ 2024-02-11"',
        );
    });

    it('should just return task if StatusType has not changed', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const task = new TaskBuilder()
            .description('An already-DONE, non-recurring task 🏁 Delete')
            .dueDate(dueDate)
            .doneDate(dueDate)
            .status(Status.DONE)
            .build();
        expect(task.status.type).toEqual(StatusType.DONE);

        // Act
        const returnedTasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(returnedTasks.length).toEqual(1);
        expect(toLines(returnedTasks).join('\n')).toMatchInlineSnapshot(
            '"- [x] An already-DONE, non-recurring task 🏁 Delete 📅 2024-02-10 ✅ 2024-02-10"',
        );
    });

    it('should just return trigger-less, non-recurring task', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const task = new TaskBuilder().description('A non-recurring task with no trigger').dueDate(dueDate).build();
        expect(task.status.type).toEqual(StatusType.TODO);

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks.length).toEqual(1);
        expect(toLines(tasks).join('\n')).toMatchInlineSnapshot(
            '"- [x] A non-recurring task with no trigger 📅 2024-02-10 ✅ 2024-02-11"',
        );
    });

    it('should just return trigger-less recurring task', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const recurrence = new RecurrenceBuilder().rule('every day').dueDate(dueDate).build();
        const task = new TaskBuilder()
            .description('A recurring task with no trigger')
            .recurrence(recurrence)
            .dueDate(dueDate)
            .build();
        expect(task.status.type).toEqual(StatusType.TODO);

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks.length).toEqual(2);
        expect(toLines(tasks).join('\n')).toMatchInlineSnapshot(`
            "- [ ] A recurring task with no trigger 🔁 every day 📅 2024-02-11
            - [x] A recurring task with no trigger 🔁 every day 📅 2024-02-10 ✅ 2024-02-11"
        `);
    });

    it('should just return the task when going from TODO to IN_PROGRESS', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const recurrence = new RecurrenceBuilder().rule('every day').dueDate(dueDate).build();
        const task = new TaskBuilder()
            .description('A recurring task with 🏁 Delete')
            .recurrence(recurrence)
            .dueDate(dueDate)
            .build();

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeInProgress());

        // Assert
        expect(tasks.length).toEqual(1);
        expect(tasks[0].status.type).toEqual(StatusType.IN_PROGRESS);
    });

    it('should just return the task when going from one DONE status to another DONE status', () => {
        // Arrange
        const done1 = new Status(new StatusConfiguration('x', 'done', ' ', true, StatusType.DONE));
        const done2 = new Status(new StatusConfiguration('X', 'DONE', ' ', true, StatusType.DONE));
        const task = new TaskBuilder().description('A simple done task with 🏁 Delete').status(done1).build();

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, done2);

        // Assert
        expect(tasks.length).toEqual(1);
        expect(tasks[0].status.symbol).toEqual('X');
        expect(tasks[0].status.type).toEqual(StatusType.DONE);
    });

    it('should just return the task when it contains the On Completion flag trigger but an empty string Action', () => {
        // Arrange
        const task = new TaskBuilder().description('A non-recurring task with 🏁').build();

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks.length).toEqual(1);
    });
});

describe('OnCompletion - visualise behaviour', () => {
    type ToggleCase = {
        // inputs:
        nextStatus: Status;
        line: string;
    };

    function getCases(): ToggleCase[] {
        return [
            // Non-recurring
            {
                nextStatus: Status.makeDone(),
                line: '- [ ] A non-recurring task with no trigger 📅 2024-02-10',
            },

            {
                nextStatus: Status.makeDone(),
                line: '- [ ] A non-recurring task with 🏁 Delete',
            },

            {
                nextStatus: Status.makeDone(),
                line: '- [ ] A non-recurring task with 🏁 Delete 📅 2024-02-10',
            },

            {
                nextStatus: Status.makeDone(),
                line: '- [ ] A non-recurring task with invalid OC trigger 🏁 INVALID_ACTION 📅 2024-02-10',
            },

            {
                nextStatus: Status.makeDone(),
                line: '- [ ] A non-recurring task with 🏁',
            },

            // Recurring

            {
                nextStatus: Status.makeDone(),
                line: '- [ ] A recurring task with no trigger 🔁 every day 📅 2024-02-10',
            },

            {
                nextStatus: Status.makeDone(),
                line: '- [ ] A recurring task with 🏁 Delete 🔁 every day 📅 2024-02-10',
            },

            {
                nextStatus: Status.makeInProgress(),
                line: '- [ ] A recurring task with 🏁 Delete 🔁 every day 📅 2024-02-10',
            },

            // Other

            {
                nextStatus: Status.makeDone(),
                line: '- [x] An already-DONE task, changing to Same      DONE status 🏁 Delete 📅 2024-02-10 ✅ 2024-02-10',
            },

            {
                nextStatus: new Status(new StatusConfiguration('X', 'new status', ' ', false, StatusType.DONE)),
                line: '- [x] An already-DONE task, changing to Different DONE status 🏁 Delete 📅 2024-02-10 ✅ 2024-02-10',
            },

            // Alternate initial task line characters
            {
                nextStatus: Status.makeDone(),
                line: '* [ ] Asterisk recurring task with 🏁 Delete 🔁 every day 📅 2024-04-29',
            },
            {
                nextStatus: Status.makeDone(),
                line: '+ [ ] Plus sign recurring task with 🏁 Delete 🔁 every day 📅 2024-04-30',
            },
        ];
    }

    function action(toggleCase: ToggleCase): string {
        const newStatus = toggleCase.nextStatus;
        const task = fromLine({ line: toggleCase.line, path: 'anything.md', precedingHeader: 'heading' });
        const step1 = task.handleNewStatus(newStatus);
        const step2 = applyStatusAndOnCompletionAction(task, newStatus);
        return `
initial task:
${task.toFileLineString()}

=> advances to status [${newStatus.symbol}] and type ${newStatus.type}:
${toMarkdown(step1)}

=> which, after any on-completion action, results in:
${toMarkdown(step2)}
----------------------------------------------
`;
    }

    it('verify test cases', () => {
        // List of status and task
        const cases = getCases();
        verifyAll('checking on completion', cases, (toggleCase) => action(toggleCase));
    });
});

describe('OnCompletion-test Delete action', () => {
    it('should return an empty Array for a simple, undated task', () => {
        // Arrange
        const task = new TaskBuilder().description('A non-recurring task with 🏁 Delete').build();

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks.length).toEqual(0);
    });

    it('should return an empty Array for a dated non-recurring task', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const task = new TaskBuilder().description('A non-recurring task with 🏁 Delete').dueDate(dueDate).build();
        expect(task.status.type).toEqual(StatusType.TODO);

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks).toEqual([]);
    });

    it('should return only the next instance of a recurring task', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const recurrence = new RecurrenceBuilder().rule('every day').dueDate(dueDate).build();
        const task = new TaskBuilder()
            .description('A recurring task with 🏁 Delete')
            .recurrence(recurrence)
            .dueDate(dueDate)
            .build();
        expect(task.status.type).toEqual(StatusType.TODO);

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks.length).toEqual(1);
        expect(toLines(tasks).join('\n')).toMatchInlineSnapshot(
            '"- [ ] A recurring task with 🏁 Delete 🔁 every day 📅 2024-02-11"',
        );
    });
});

describe('OnCompletion-test ToLogFile action', () => {
    it('should return an empty Array for a simple, undated task', () => {
        // Arrange
        const task = new TaskBuilder().description('A non-recurring task with 🏁 ToLogFile').build();

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks.length).toEqual(0);
    });
});

export function applyStatusAndOnCompletionAction2(
    task: Task,
    newStatus: Status,
    fileWriter: (filePath: string, fileContentUpdater: (data: string) => string) => void,
) {
    const tasks = task.handleNewStatus(newStatus);
    return handleOnCompletion(task, tasks, 'archive.md', fileWriter);
}

function setupTestAndCaptureData(line: string, newStatus: Status, simulatedData: string) {
    const task = fromLine({ line: line });
    let capturedUpdatedData; // Variable to capture the updated data

    // Create a Jest spy for the file writer
    const mockFileWriter = jest.fn((_filePath: string, fileContentUpdater: (data: string) => string) => {
        capturedUpdatedData = fileContentUpdater(simulatedData); // Execute updater function and capture the result
    });

    // Act
    const tasks = applyStatusAndOnCompletionAction2(task, newStatus, mockFileWriter);
    return { capturedUpdatedData, tasks };
}

describe('OnCompletion-ToLogFile', () => {
    it('should write completed instance of non-recurring task to empty log file', () => {
        // Arrange
        const line = '- [ ] A non-recurring task with 🏁 ToLogFile 📅 2024-02-10';
        const simulatedData = ''; // Example initial data

        // Act
        const { capturedUpdatedData, tasks } = setupTestAndCaptureData(line, Status.makeDone(), simulatedData);

        // Assert
        expect(tasks).toEqual([]);
        expect(capturedUpdatedData).toBe(`- [x] A non-recurring task with 🏁 ToLogFile 📅 2024-02-10 ✅ 2024-02-11
`);
    });

    it('should not update any file if task is not completed', () => {
        // Arrange
        const line = '- [x] A task that was DONE 🏁 ToLogFile';
        const simulatedData = ''; // Example initial data

        // Act
        const { capturedUpdatedData, tasks } = setupTestAndCaptureData(line, Status.makeTodo(), simulatedData);

        // Assert
        expect(toMarkdown(tasks)).toEqual('- [ ] A task that was DONE 🏁 ToLogFile');
        // Because the updated task is not DONE, no file output should have been written:
        expect(capturedUpdatedData).toBeUndefined();
    });

    it('should append a recurring task to end of an existing file', () => {
        // Arrange
        const line = '- [ ] Recurring task 🏁 ToLogFile 🔁 every day 📅 2024-02-11';
        const simulatedData = '# Existing heading - without end-of-line';

        // Act
        const { capturedUpdatedData, tasks } = setupTestAndCaptureData(line, Status.makeDone(), simulatedData);

        // Assert
        expect(toMarkdown(tasks)).toEqual('- [ ] Recurring task 🏁 ToLogFile 🔁 every day 📅 2024-02-12');
        expect(capturedUpdatedData).toBe(`# Existing heading - without end-of-line
- [x] Recurring task 🏁 ToLogFile 🔁 every day 📅 2024-02-11 ✅ 2024-02-11
`);
    });

    it('should return only the next instance of a recurring task', () => {
        // Arrange
        const dueDate = '2024-02-10';
        const recurrence = new RecurrenceBuilder().rule('every day').dueDate(dueDate).build();
        const task = new TaskBuilder()
            .description('A recurring task with 🏁 ToLogFile')
            .recurrence(recurrence)
            .dueDate(dueDate)
            .build();
        expect(task.status.type).toEqual(StatusType.TODO);

        // Act
        const tasks = applyStatusAndOnCompletionAction(task, Status.makeDone());

        // Assert
        expect(tasks.length).toEqual(1);
        expect(toLines(tasks).join('\n')).toMatchInlineSnapshot(
            '"- [ ] A recurring task with 🏁 ToLogFile 🔁 every day 📅 2024-02-11"',
        );
    });
});

describe('OnCompletion-test EndOfList action', () => {
    it('should insert line at end of list when list is followed by a blank line', () => {
        const initialContentNoNewLine = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task

Final line in note file.`;
        const expectedContent = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST

Final line in note file.`;
        const targetListHeading = '## MY TASK LIST';
        const textToAppend = '- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST';
        const newFile = writeLineToListEnd(initialContentNoNewLine, targetListHeading, textToAppend);
        expect(newFile).toEqual(expectedContent);
    });

    it('should insert line at end of list when list followed by regular text', () => {
        const initialContentNoNewLine = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
A line of regular text.`;
        const expectedContent = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST
A line of regular text.`;
        const targetListHeading = '## MY TASK LIST';
        const textToAppend = '- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST';
        const newFile = writeLineToListEnd(initialContentNoNewLine, targetListHeading, textToAppend);
        expect(newFile).toEqual(expectedContent);
    });

    it('should insert line at end of list when list followed by a markdown heading', () => {
        const initialContentNoNewLine = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
## Another list heading`;
        const expectedContent = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST
## Another list heading`;
        const targetListHeading = '## MY TASK LIST';
        const textToAppend = '- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST';
        const newFile = writeLineToListEnd(initialContentNoNewLine, targetListHeading, textToAppend);
        expect(newFile).toEqual(expectedContent);
    });

    it('should insert line at end of list when end of list is last line in note file', () => {
        const initialContentNoNewLine = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task`;
        const expectedContent = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST`;
        const targetListHeading = '## MY TASK LIST';
        const textToAppend = '- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST';
        const newFile = writeLineToListEnd(initialContentNoNewLine, targetListHeading, textToAppend);
        expect(newFile).toEqual(expectedContent);
    });

    it('should recognize indented tasks as part of list', () => {
        const initialContentNoNewLine = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
    - [ ] An INDENTED incomplete task`;
        const expectedContent = `Sed ipsam libero qui consequuntur quaerat non atque quia ab praesentium explicabo.
## MY TASK LIST
- [ ] An incomplete task
    - [ ] An INDENTED incomplete task
- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST`;
        const targetListHeading = '## MY TASK LIST';
        const textToAppend = '- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST';
        const newFile = writeLineToListEnd(initialContentNoNewLine, targetListHeading, textToAppend);
        expect(newFile).toEqual(expectedContent);
    });

    it('should recognize tasks in block quote as part of list', () => {
        const initialContentNoNewLine = `> Sed ipsam libero qui consequuntur quaerat...
> ## MY TASK LIST
>    - [ ] An INDENTED incomplete task`;
        const expectedContent = `> Sed ipsam libero qui consequuntur quaerat...
> ## MY TASK LIST
>    - [ ] An INDENTED incomplete task
- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST`;
        const targetListHeading = '> ## MY TASK LIST';
        const textToAppend = '- [-] A COMPLETED TASK TO INSERT AT END OF NAMED LIST';
        const newFile = writeLineToListEnd(initialContentNoNewLine, targetListHeading, textToAppend);
        expect(newFile).toEqual(expectedContent);
    });
});

describe('OnCompletion-helper-removeBlockQuote|Calloutprefixes', () => {
    it('should remove single "> " prefix from a string', () => {
        const initialContent = '> - [ ] An INDENTED incomplete task';
        const expectedContent = '- [ ] An INDENTED incomplete task';
        expect(expectedContent).toEqual(removeBlockQuoteCalloutPrefixes(initialContent));
    });

    it('should remove multiple "> " prefixes from a string', () => {
        const initialContent = '> > - [ ] An INDENTED incomplete task';
        const expectedContent = '- [ ] An INDENTED incomplete task';
        expect(expectedContent).toEqual(removeBlockQuoteCalloutPrefixes(initialContent));
    });
});

describe('OnCompletion-helper-prepareTaskLineForArchiving', () => {
    it('should remove single space indent from a string', () => {
        const initialContent = ' - [ ] An INDENTED incomplete task';
        const expectedContent = '- [ ] An INDENTED incomplete task';
        expect(expectedContent).toEqual(prepareTaskLineForArchiving(initialContent));
    });

    it('should remove double space indent from a string', () => {
        const initialContent = '  - [ ] An INDENTED incomplete task';
        const expectedContent = '- [ ] An INDENTED incomplete task';
        expect(expectedContent).toEqual(prepareTaskLineForArchiving(initialContent));
    });

    it('should remove indent from a string within a block quote|callout', () => {
        const initialContent = '> >    - [ ] An INDENTED incomplete task';
        const expectedContent = '- [ ] An INDENTED incomplete task';
        expect(expectedContent).toEqual(prepareTaskLineForArchiving(initialContent));
    });
    prepareTaskLineForArchiving;
});
