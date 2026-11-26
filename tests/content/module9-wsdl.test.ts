// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { getTheoryParts } from "../../src/content/loader";

const soap = getTheoryParts("9").find((p) => p.title.startsWith("SOAP"))!;
const documenting = getTheoryParts("9").find((p) => p.title.startsWith("Документирование API"))!;
const glossary = getTheoryParts("9").slice(-1)[0];

const xmlBlocks = [...soap.body.matchAll(/```xml(?: file=\S+)?\n([\s\S]*?)```/g)].map((m) => m[1]);
const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const WSDL_NS = "http://schemas.xmlsoap.org/wsdl/";
const SOAP_NS = "http://schemas.xmlsoap.org/wsdl/soap/";

describe("Теория модуля 9: WSDL (рецензия)", () => {
  it("в главе 5 есть раздел про WSDL с расшифровкой, шестью элементами и стилями привязки", () => {
    expect(soap.body).toContain("## WSDL: как описывают SOAP-службу");
    expect(soap.body).toContain("Web Services Description Language");
    for (const el of ["types", "message", "portType", "binding", "port", "service"]) expect(soap.body, el).toContain(`**${el}**`);
    expect(soap.body).toContain("`rpc`");
    expect(soap.body).toContain("`document`");
    expect(soap.body).toContain("с. 169");
    expect(soap.body).toContain("с. 171");
  });

  it("примечание объясняет расхождение с книгой: Description, а не Definition", () => {
    expect(soap.body).toMatch(/Definition/);
    expect(soap.body).toMatch(/Description/);
  });

  it("пример WSDL: корректный XML с шестью элементами версии 1.1", () => {
    const doc = parse(xmlBlocks.find((b) => b.includes("<definitions"))!);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    const root = doc.documentElement;
    expect(root.localName).toBe("definitions");
    expect(root.namespaceURI).toBe(WSDL_NS);
    const kids = [...root.children].map((e) => e.localName);
    expect(kids).toEqual(["types", "message", "message", "portType", "binding", "service"]);
  });

  it("пример WSDL: ссылки между элементами согласованы", () => {
    const doc = parse(xmlBlocks.find((b) => b.includes("<definitions"))!);
    const root = doc.documentElement;
    const names = (tag: string) => [...root.getElementsByTagNameNS(WSDL_NS, tag)].map((e) => e.getAttribute("name"));
    const local = (v: string | null) => (v ?? "").replace(/^tns:/, "");
    const messages = names("message");
    for (const tag of ["input", "output"]) {
      for (const op of root.getElementsByTagNameNS(WSDL_NS, "portType")[0].getElementsByTagNameNS(WSDL_NS, tag)) {
        expect(messages, tag).toContain(local(op.getAttribute("message")));
      }
    }
    const binding = root.getElementsByTagNameNS(WSDL_NS, "binding")[0];
    expect(names("portType")).toContain(local(binding.getAttribute("type")));
    const port = root.getElementsByTagNameNS(WSDL_NS, "port")[0];
    expect(names("binding")).toContain(local(port.getAttribute("binding")));
    expect(binding.getElementsByTagNameNS(SOAP_NS, "binding")[0].getAttribute("style")).toBe("document");
  });

  it("пример WSDL согласован с SOAP-запросом той же главы: пространство имён, операция и параметр", () => {
    const wsdl = parse(xmlBlocks.find((b) => b.includes("<definitions"))!);
    const request = parse(xmlBlocks.find((b) => b.includes("soap:Envelope"))!);
    const target = wsdl.documentElement.getAttribute("targetNamespace");
    const op = request.getElementsByTagNameNS(target, "GetStudent")[0];
    expect(op).toBeTruthy();
    expect(op.getElementsByTagNameNS(target, "id")).toHaveLength(1);
    const schema = wsdl.getElementsByTagName("xsd:schema")[0];
    expect(schema.getAttribute("elementFormDefault")).toBe("qualified");
    expect([...schema.children].map((e) => e.getAttribute("name"))).toContain("GetStudent");
  });

  it("пример WSDL оформлен как скачиваемый документ school.wsdl", () => {
    expect(soap.body).toContain("```xml file=school.wsdl");
  });

  it("глава 8 сравнивает WSDL и OpenAPI, а словарь содержит WSDL", () => {
    expect(documenting.body).toContain("### А что для SOAP: WSDL");
    expect(documenting.body).toContain("`portType`");
    expect(documenting.body).toContain("`paths`");
    expect(glossary.body).toMatch(/\| WSDL \| Web Services Description Language/);
    expect(glossary.body).toContain("Документ WSDL");
    expect(glossary.body).toContain("Стиль привязки");
  });
});
