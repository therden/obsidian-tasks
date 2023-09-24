import * as RegExpTools from '../lib/RegExpTools';

/**
 * GlobalFilter has its own data, independent of {@link Settings.globalFilter} value in {@link Settings}.
 *
 * See https://publish.obsidian.md/tasks/Getting+Started/Global+Filter
 *
 * Limitations:
 * - All methods are static, so it is a collection of multiple static things
 *     - This is in contrast to {@link GlobalQuery} what has just the one static method, {@link GlobalQuery.getInstance}.
 *     - These static methods will be made non-static in a future change.
 */
export class GlobalFilter {
    private static instance: GlobalFilter;

    static empty = '';
    _globalFilter = '';
    _removeGlobalFilter = false;

    /**
     * Provides access to the single global instance of GlobalFilter.
     * This should eventually only be used in the plugin code.
     */
    public static getInstance(): GlobalFilter {
        if (!GlobalFilter.instance) {
            GlobalFilter.instance = new GlobalFilter();
        }

        return GlobalFilter.instance;
    }

    static get(): string {
        return GlobalFilter.getInstance()._globalFilter;
    }

    static set(value: string) {
        GlobalFilter.getInstance()._globalFilter = value;
    }

    static reset() {
        GlobalFilter.set(GlobalFilter.empty);
    }

    static isEmpty(): boolean {
        return GlobalFilter.get() === GlobalFilter.empty;
    }

    static equals(tag: string): boolean {
        return GlobalFilter.get() === tag;
    }

    static includedIn(description: string): boolean {
        const globalFilter = GlobalFilter.get();
        return description.includes(globalFilter);
    }

    static prependTo(description: string): string {
        return GlobalFilter.get() + ' ' + description;
    }

    static removeAsWordFromDependingOnSettings(description: string): string {
        const removeGlobalFilter = GlobalFilter.getRemoveGlobalFilter();
        if (removeGlobalFilter) {
            return GlobalFilter.removeAsWordFrom(description);
        }

        return description;
    }

    /**
     * @see setRemoveGlobalFilter
     */
    static getRemoveGlobalFilter() {
        return GlobalFilter.getInstance()._removeGlobalFilter;
    }

    /**
     * @see getRemoveGlobalFilter
     */
    static setRemoveGlobalFilter(removeGlobalFilter: boolean) {
        GlobalFilter.getInstance()._removeGlobalFilter = removeGlobalFilter;
    }

    /**
     * Search for the global filter for the purpose of removing it from the description, but do so only
     * if it is a separate word (preceding the beginning of line or a space and followed by the end of line
     * or a space), because we don't want to cut-off nested tags like #task/subtag.
     * If the global filter exists as part of a nested tag, we keep it untouched.
     */
    static removeAsWordFrom(description: string): string {
        if (GlobalFilter.isEmpty()) {
            return description;
        }

        // This matches the global filter (after escaping it) only when it's a complete word
        const theRegExp = RegExp('(^|\\s)' + RegExpTools.escapeRegExp(GlobalFilter.get()) + '($|\\s)', 'ug');

        if (description.search(theRegExp) > -1) {
            description = description.replace(theRegExp, '$1$2').replace('  ', ' ').trim();
        }

        return description;
    }

    static removeAsSubstringFrom(description: string): string {
        const globalFilter = GlobalFilter.get();
        return description.replace(globalFilter, '').trim();
    }
}
