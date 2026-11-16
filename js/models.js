
"use strict";


export class IDGenerator {
    static #counters = new Map();

    static generate(prefix = "ID") {
        const current = IDGenerator.#counters.get(prefix) || 0;
        const next = current + 1;

        IDGenerator.#counters.set(prefix, next);

        return `${prefix}-${Date.now().toString(36)}-${next}`;
    }
}


export class User {
    constructor({ id = IDGenerator.generate("USER"), name, role, initials, color = "purple" }) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.initials = initials || name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
        this.color = color;
    }

    getProfile() {
        return {
            id: this.id,
            name: this.name,
            role: this.role,
            initials: this.initials
        };
    }
}


export class Comment {
    constructor({ id = IDGenerator.generate("COMMENT"), user, text, createdAt = new Date().toISOString() }) {
        this.id = id;
        this.user = user;
        this.text = text;
        this.createdAt = createdAt;
    }
}


export class Attachment {
    constructor({ id = IDGenerator.generate("FILE"), name, url, size = 0 }) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.size = size;
    }
}


export class ActivityLog {
    constructor({ id = IDGenerator.generate("ACT"), action, description, user, createdAt = new Date().toISOString() }) {
        this.id = id;
        this.action = action;
        this.description = description;
        this.user = user;
        this.createdAt = createdAt;
    }

    static create(action, description, user = "System") {
        return new ActivityLog({ action, description, user });
    }
}


export class Project {
    #tasks = [];
    #members = [];

    constructor({
        id = IDGenerator.generate("PROJECT"),
        title,
        description = "",
        startDate = new Date().toISOString().slice(0, 10),
        dueDate,
        status = "active",
        members = []
    }) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.startDate = startDate;
        this.dueDate = dueDate;
        this.status = status;

        this.#members = [...members];
    }

    get members() {
        return [...this.#members];
    }

    get tasks() {
        return [...this.#tasks];
    }

    addMember(user) {
        if (!this.#members.some(member => member.id === user.id)) {
            this.#members.push(user);
        }
    }

    removeMember(userId) {
        this.#members = this.#members.filter(member => member.id !== userId);
    }

    addTask(task) {
        if (task.projectId !== this.id) {
            throw new Error("Task belongs to a different project.");
        }

        if (this.#tasks.some(existing => existing.id === task.id)) {
            throw new Error("Task already exists in this project.");
        }

        this.#tasks.push(task);
    }

    removeTask(taskId) {
        this.#tasks = this.#tasks.filter(task => task.id !== taskId);
    }

    getSummary() {
        return Task.calculateSummary(this.#tasks);
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            startDate: this.startDate,
            dueDate: this.dueDate,
            status: this.status,
            members: this.#members.map(member => member.id)
        };
    }
}


export class Task {
    #description;
    #assignees = [];
    #comments = [];
    #attachments = [];
    #activityLog = [];

    constructor({
        id = IDGenerator.generate("TASK"),
        title,
        description = "",
        priority = "medium",
        status = "todo",
        dueDate,
        estimatedHours = 1,
        projectId,
        assignees = [],
        comments = [],
        attachments = [],
        activityLog = [],
        createdAt = new Date().toISOString()
    }) {
        this.id = id;
        this.title = title;
        this.#description = description;
        this.priority = priority;
        this.status = status;
        this.dueDate = dueDate;
        this.estimatedHours = Number(estimatedHours);
        this.projectId = projectId;
        this.createdAt = createdAt;

        this.#assignees = [...assignees];
        this.#comments = [...comments];
        this.#attachments = [...attachments];
        this.#activityLog = [...activityLog];
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (typeof value !== "string") {
            throw new TypeError("Description must be a string.");
        }

        this.#description = value.trim();
    }

    get assignees() {
        return [...this.#assignees];
    }

    get comments() {
        return [...this.#comments];
    }

    get attachments() {
        return [...this.#attachments];
    }

    get activityLog() {
        return [...this.#activityLog];
    }

    get type() {
        return "general";
    }

    get isOverdue() {
        if (this.status === "completed" || !this.dueDate) {
            return false;
        }

        return new Date(`${this.dueDate}T23:59:59`) < new Date();
    }

    assignTo(user) {
        if (!(user instanceof User)) {
            throw new TypeError("Assignee must be a User object.");
        }

        if (!this.#assignees.some(assignee => assignee.id === user.id)) {
            this.#assignees.push(user);
            this.addActivity("assignment", `${user.name} was assigned to "${this.title}".`);
        }

        return this;
    }

    removeAssignee(userId) {
        const user = this.#assignees.find(item => item.id === userId);

        this.#assignees = this.#assignees.filter(item => item.id !== userId);

        if (user) {
            this.addActivity("assignment", `${user.name} was removed from "${this.title}".`);
        }

        return this;
    }

    update(data) {
        if (data.title !== undefined) {
            if (!data.title.trim()) {
                throw new Error("Task title cannot be empty.");
            }

            this.title = data.title.trim();
        }

        if (data.description !== undefined) {
            this.description = data.description;
        }

        if (data.priority !== undefined) {
            this.priority = data.priority;
        }

        if (data.dueDate !== undefined) {
            this.dueDate = data.dueDate;
        }

        if (data.estimatedHours !== undefined) {
            const hours = Number(data.estimatedHours);

            if (!Number.isFinite(hours) || hours <= 0) {
                throw new Error("Estimated hours must be greater than zero.");
            }

            this.estimatedHours = hours;
        }

        if (data.status !== undefined) {
            this.changeStatus(data.status);
        }

        this.addActivity("update", `"${this.title}" was updated.`);

        return this;
    }

    changeStatus(status) {
        const allowedStatuses = ["todo", "in-progress", "completed"];

        if (!allowedStatuses.includes(status)) {
            throw new Error("Invalid task status.");
        }

        this.status = status;
        this.addActivity("status", `"${this.title}" status changed to ${status}.`);

        return this;
    }

    complete() {
        return this.changeStatus("completed");
    }

    reopen() {
        return this.changeStatus("todo");
    }

    addComment(comment) {
        if (!(comment instanceof Comment)) {
            throw new TypeError("Expected a Comment object.");
        }

        this.#comments.push(comment);
        this.addActivity("comment", `A comment was added to "${this.title}".`);

        return this;
    }

    addAttachment(attachment) {
        if (!(attachment instanceof Attachment)) {
            throw new TypeError("Expected an Attachment object.");
        }

        this.#attachments.push(attachment);

        return this;
    }

    addActivity(action, description, user = "System") {
        this.#activityLog.push(
            ActivityLog.create(action, description, user)
        );
    }

    getDetails() {
        return {
            id: this.id,
            title: this.title,
            description: this.#description,
            type: this.type,
            priority: this.priority,
            status: this.status,
            dueDate: this.dueDate,
            estimatedHours: this.estimatedHours,
            projectId: this.projectId,
            assignees: this.assignees,
            isOverdue: this.isOverdue
        };
    }

    getSummary() {
        return `${this.title} — ${this.type} task`;
    }

    duplicate() {
        const copyData = structuredClone(this.toJSON());

        delete copyData.id;

        copyData.assignees = this.#assignees.map(user => user);

        return TaskFactory.create(this.type, copyData);
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.#description,
            priority: this.priority,
            status: this.status,
            dueDate: this.dueDate,
            estimatedHours: this.estimatedHours,
            projectId: this.projectId,
            assignees: this.#assignees.map(user => user.id),
            comments: this.#comments.map(comment => ({
                id: comment.id,
                user: comment.user,
                text: comment.text,
                createdAt: comment.createdAt
            })),
            attachments: this.#attachments.map(attachment => ({
                id: attachment.id,
                name: attachment.name,
                url: attachment.url,
                size: attachment.size
            })),
            activityLog: this.#activityLog.map(activity => ({
                id: activity.id,
                action: activity.action,
                description: activity.description,
                user: activity.user,
                createdAt: activity.createdAt
            })),
            createdAt: this.createdAt,
            type: this.type
        };
    }

    static calculateSummary(tasks) {
        return tasks.reduce((summary, task) => {
            summary.totalTasks++;
            summary.completedTasks += task.status === "completed" ? 1 : 0;
            summary.pendingTasks += task.status !== "completed" ? 1 : 0;
            summary.overdueTasks += task.isOverdue ? 1 : 0;
            summary.totalHours += task.estimatedHours;

            return summary;
        }, {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            totalHours: 0
        });
    }
}


export class DevelopmentTask extends Task {
    constructor(data) {
        super(data);
        this.technology = data.technology || "JavaScript";
    }

    get type() {
        return "development";
    }

    getSummary() {
        return `${super.getSummary()} — Technology: ${this.technology}`;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            technology: this.technology
        };
    }
}


export class TestingTask extends Task {
    constructor(data) {
        super(data);
        this.testEnvironment = data.testEnvironment || "Browser";
    }

    get type() {
        return "testing";
    }

    getSummary() {
        return `${this.title} — Testing in ${this.testEnvironment}`;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            testEnvironment: this.testEnvironment
        };
    }
}


export class DocumentationTask extends Task {
    constructor(data) {
        super(data);
        this.documentFormat = data.documentFormat || "Markdown";
    }

    get type() {
        return "documentation";
    }

    getSummary() {
        return `${this.title} — Documentation (${this.documentFormat})`;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            documentFormat: this.documentFormat
        };
    }
}


export class TaskFactory {
    static create(type, data) {
        const taskTypes = {
            development: DevelopmentTask,
            testing: TestingTask,
            documentation: DocumentationTask
        };

        const TaskClass = taskTypes[type];

        if (!TaskClass) {
            throw new Error(`Unknown task type: ${type}`);
        }

        return new TaskClass(data);
    }
}


export function LegacyTask(title, status = "todo") {
    this.title = title;
    this.status = status;
}

LegacyTask.prototype.getLabel = function () {
    return `${this.title} (${this.status})`;
};


export const ObjectTools = {

    setPrototypeExample() {
        const firstPrototype = {
            greet() {
                return "Hello from the first prototype.";
            }
        };

        const secondPrototype = {
            greet() {
                return "Hello from the second prototype.";
            }
        };

        const object = Object.create(firstPrototype);

        Object.setPrototypeOf(object, secondPrototype);

        return {
            object,
            prototype: Object.getPrototypeOf(object),
            result: object.greet()
        };
    },

    createPrototypeExample() {
        const base = {
            describe() {
                return "This method comes from the prototype.";
            }
        };

        const child = Object.create(base);

        child.name = "Prototype Example";

        return {
            child,
            prototype: Object.getPrototypeOf(child)
        };
    },

    createDescriptorExample() {
        const settings = {};

        Object.defineProperty(settings, "appName", {
            value: "TaskFlow",
            writable: false,
            enumerable: true,
            configurable: false
        });

        return settings;
    },

    createFrozenExample() {
        return Object.freeze({
            application: "TaskFlow",
            version: 1
        });
    },

    createSealedExample() {
        return Object.seal({
            theme: "dark",
            language: "en"
        });
    },

    preventNewProperties(object) {
        return Object.preventExtensions(object);
    },

    shallowClone(object) {
        return { ...object };
    },

    deepClone(object) {
        return structuredClone(object);
    }
};
