export default function jsx(
    tag: string | Function, 
    attributes: { [key: string]: any } | null, 
    ...children: Node[]
) {
    if (typeof tag === 'function') {
        return tag(attributes ?? {}, children);
    }

    const element = document.createElement(tag);

    let map = attributes ?? {};
    for (let [prop, value] of Object.entries(map)) {
        prop = prop.toString();
        if (typeof element[prop] === 'undefined') {
            element.setAttribute(prop, value);
        } else {
            element[prop] = value;
        }
    }

    for (let child of children) {
        if (typeof child === 'string') {
            element.innerHTML += child;
            continue;
        }
        if (Array.isArray(child)) {
            element.append(...child);
            continue;
        }
        element.appendChild(child);
    }
    
    return element;
}

jsx.Fragment = function(attributes: { [key: string]: any }, ...children: Node[]): Node[] {
    return children;
}