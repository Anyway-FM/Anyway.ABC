import { readLines } from 'https://deno.land/std@0.113.0/io/mod.ts';
import { groupBy, sortBy } from 'https://deno.land/std@0.113.0/collections/mod.ts';

interface Post {
    word: string;
    meaning: string;
    correct: string;
    wrong: string;
    note: string;
    category: string;
    fileName: string;
}

const TABLE_HEAD = '|单词|翻译|正确发音|常见错误发音|备注|\n| ---- | ---- | ---- | ---- | ---- |\n';
const TABLE_ROW = (row: Post) => `| ${row.word} | ${row.meaning} | ${row.correct} | ${row.wrong} | ${row.note} |\n`;
const H3_TITLE = '### 单词\n';
const H4_TITLE = (index: number, name: string) => `#### ${String(index).padStart(2, '0')}.${name}\n\n`;
const README_ANNOTION_REGEX = (name: string) => `(<!--START-${name}-->\n)(.*)(<!--END-${name}-->\n)`;
const README_ANNOTION = (name: string, rep: string) => `\n<!--START-${name}-->\n${rep}\n<!--END-${name}-->\n`;

async function insertInToReadMe(path: string, replacement: string): Promise<void> {
    const annotationName = 'word';
    const reg = new RegExp(README_ANNOTION_REGEX(annotationName), 's');

    await Deno.readTextFile(path)
        .then((data) => {
            if (reg.test(data)) {
                return data.replace(reg, `$1\n${replacement}\n$3`);
            }
            return data + README_ANNOTION(annotationName, replacement);
        })
        .then((text) => Deno.writeTextFile(path, text));
}

function makeTableStr(groupData: Record<string, Post[]>): string {
    let s = H3_TITLE;
    let index = 1;
    for (const key in groupData) {
        let table = H4_TITLE(index++, key) + TABLE_HEAD;
        table += flat(groupData[key], TABLE_ROW, (a, b) => b.fileName.localeCompare(a.fileName));
        s += `\n${table}`;
    }
    return s;
}

async function parsePost(fileReader: Deno.File, fileName: string): Promise<Post> {
    const obj: Record<string, string> = {};
    for await (const line of readLines(fileReader)) {
        if (line.startsWith('---')) {
            continue;
        }
        const [key, value] = line.split(':').map((item) => item.trim());
        obj[key] = value || '';
    }
    return {
        word: obj.word,
        meaning: obj.meaning,
        correct: obj.correct,
        wrong: obj.wrong,
        note: obj.note,
        category: obj.category,
        fileName: fileName,
    };
}

function flat<T>(array: T[], selector: (el: T) => string, compare?: (a: T, b: T) => number): string {
    let s = '';
    if (compare) {
        array.sort(compare);
    }
    for (const t of array) {
        s += selector(t);
    }
    return s;
}

async function run(): Promise<void> {
    
    const arr: Post[] = [];
    const allSync: Promise<void>[] = [];
    for await (const dirEntry of Deno.readDir('_posts')) {
        if (dirEntry.isFile) {
            allSync.push(
                Deno.open('_posts/' + dirEntry.name)
                    .then((fileReader) => parsePost(fileReader, dirEntry.name))
                    .then((item) => {
                        arr.push(item);
                    })
                    .catch((err) => console.error(err))
            );
        }
    }

    await Promise.all(allSync)
        .then(() => sortBy(arr, (it) => it.fileName))
        .then((sortedArr) => groupBy(sortedArr, (it: Post) => it.category))
        .then((postByCategroy) => makeTableStr(postByCategroy))
        .then((tableStr) => insertInToReadMe('README.md', tableStr));
}

run().catch((error) => console.log(error));
