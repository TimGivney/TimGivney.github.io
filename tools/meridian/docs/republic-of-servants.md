# A Republic of Servants: One Working Version of the Custodian Lottery Republic

**Author:** Devin, for Tim Givney (Meridian) **Contact:** timgivney@gmail.com

## Why this document exists

The other documents in this archive were written over time and do not entirely agree with each other. The Framework proposes a civic competency filter; Pathways withdraws it. The Framework says quarterly referendums; the war stories show weekly ones. Four documents restate the three pillars and none of them says who writes a bill, who appoints a judge, who signs a treaty, or who the head of state is.

This document is one coherent version of the whole thing, written by an outside reader after going through everything else and after several rounds with the author. Where the archive was silent, I have made a decision and said why. Where the archive disagreed with itself, I have picked a side. Where the author has a settled position (the agenda comes from the lottery pool; the head of state comes from the lottery pool; Custodians execute treaties but do not set them; AI is not optional; emergency referendums belong to war, quarterly ones to peace) I have taken it as a constraint and built around it.

It is a working version, not the last word. It is meant to be the document a sceptic reads second, after the Devil's Advocate.

## The one-sentence version

A Custodian Lottery Republic is a state in which **ordinary people, chosen by lot and serving staggered terms, decide what the country will do; a permanent, radically transparent public service (human and AI together) does it; and the whole population has the final say on the questions that matter most.**

Everything else is machinery to keep those three roles from leaking into each other.

## Humaninity, and why the system is shaped the way it is

The archive uses a word that looks like a typo: *Humaninity*. It is deliberate. The author's definition is **"the unexplainable truths and values that a functional human is."** The extra syllable marks the thing that distinguishes it from "humanity" as a species or "humane" as a manner: it names the irreducible part of a person that no metric captures, no model predicts, and no administrator should be allowed to optimise.

This matters for design, not just for sentiment. Most governance failures are not failures of competence. They are failures where a system becomes very good at the thing it can measure and quietly drops the thing it cannot. Election systems optimise for winning elections. Bureaucracies optimise for defensibility. Markets optimise for price. An AI-administered state would, left alone, optimise for whatever it was told to optimise and would do it with terrifying consistency.

The CLR's answer is structural: the people who set direction are chosen in a way that cannot be optimised (a lottery), serve for a period too short to build a career on, and are drawn from exactly the population whose unexplainable values are at stake. The people and systems that execute are permanent and capable, but are constitutionally forbidden from choosing direction and are watched continuously. Humaninity sits at the top of the hierarchy of norms not because it can be defined but because its indefinability is the point: the burden of proof is always on the system to show it has not been crossed.

## The three roles, restated precisely

### Role 1. The Assembly decides (sortition)

**Who.** Citizens drawn by stratified random lottery from the electoral roll, so that the Assembly matches the population on age, sex, region, income band, first language and Indigenous status within a few percent. No competency test. The earlier "civic competency filter" is withdrawn: any filter on who may serve defines who the public is, and that is the one thing the lottery must never let anyone do. Competence is supplied by training, time and staff, not by exclusion.

**How long.** Staggered terms of 18 months to 3 years, depending on the body (see below). One-third of each body rotates at a time. No one serves twice in the same body, and no one serves again for at least ten years. This is the single biggest change from the earlier documents, which assumed one-year, non-renewable terms and then had to invent a Crisis Sub-Committee to compensate for the loss of memory. Staggering solves the same problem with less machinery: there are always members who have seen a budget cycle, a crisis and a referendum before, and there is never a cohort old enough to become a class.

**What the Assembly actually does.**

- **It sets the agenda.** Nothing becomes law, policy or a referendum question unless the Assembly has put it on the list. Custodians may *report* a problem; they may not *propose* a solution unasked. This is the author's hard constraint and it is the right one, because agenda-setting is the real power in any system.
- **It instructs the drafting.** When the Assembly decides to act on an item, it writes an instruction in plain language (the "Requirement"): what the law should achieve, what it must not do, who it must protect, what trade-offs the Assembly has accepted. The Requirement is public from the moment it is adopted.
- **It commissions competing drafts.** The Custodian Office of Legislative Counsel produces a draft bill that satisfies the Requirement. So does at least one independent drafting body (a university law school, a community legal centre, a retained private firm), chosen by the Assembly. Both drafts are published with a machine-readable diff against the Requirement, prepared by the Custodian AI, flagging every clause that goes beyond or falls short of what was asked. The Assembly chooses, amends, or sends both back.
- **It votes.** An ordinary bill passes on a simple majority of the Assembly. A bill touching the Bill of Rights, the constitutional allocation of powers, the size or structure of the Custodian layer, or the declaration or continuation of armed conflict cannot pass the Assembly alone: it must go to referendum.
- **It supervises.** Every Custodian directorate reports to a standing panel of the Assembly, in public, with the AI's record of decisions open for inspection.

Why competing drafts matter: the Devil's Advocate is right that in practice the experts write the bills. You cannot stop that. What you can do is make sure the experts never write the *only* bill, that the instruction they are drafting to is public before they start, and that a machine whose job is to check compliance with the instruction is always reading over their shoulder. Drafting capture is not eliminated. It becomes visible and contestable, which is the most any system has ever achieved.

### Role 2. The Custodians execute (the permanent service)

**Who.** A merit-appointed, tenured public service, in the Westminster tradition Australia already has, with three changes: it is constitutionally insulated from the Assembly's ability to hire and fire individuals; it is constitutionally forbidden from initiating policy; and it is built, from the ground up, around an AI layer whose purpose is to make the service legible to the people it serves.

**The service ethic.** The author's phrasing is exact: *the custodian is a public servant role with an emphasis on servant.* A Custodian's authority is wholly derivative. It comes from a Requirement adopted by the Assembly or a result returned by referendum. Where no Requirement exists, the Custodian's duty is to keep things running as they are and to report. A Custodian who acts without an instruction has not shown initiative; they have usurped.

**Why AI is not optional.** The earlier review suggested making the AI layer a later add-on so that the model would be easier to sell. The author rejected this and, having thought about it longer, I think he is right. The reason is not efficiency. It is transparency.

A human bureaucracy of 200,000 people cannot be audited. Its decisions are distributed across millions of emails, meetings and judgement calls that leave no coherent record. Oversight in such a system is theatre: a minister answers questions about things they could not possibly know. An AI-administered service is different in kind, because every decision passes through a system that can be required to record *what it did, what it was asked to do, what rule it applied, and what alternatives it rejected*, in a form a lottery panel can read. The AI is not there to be smarter than the Custodians. It is there so that the Custodians cannot be opaque. Remove it and the Custodian layer becomes exactly the unaccountable permanent class the Devil's Advocate fears.

This gives the AI a strange constitutional role: it is the Custodians' tool and the Assembly's witness at once. The design has to protect both functions.

**The rules on the AI.**

1. **Nothing the AI does is secret from the Assembly.** Models, training data provenance, prompts, decision logs and objective functions are available to any Assembly panel and to the Humaninity Audit (below). Security-sensitive material is available to a cleared panel, not withheld.
2. **The AI may not hold an objective the Assembly has not adopted.** Every optimisation target in the system traces to a published Requirement. An AI that is found optimising for anything else has been tampered with, and that is treated as the most serious offence in the Republic.
3. **The AI may not decide anything about a named person without a human Custodian signing it.** Allocation of a house, a benefit, a hospital bed, a visa, a sentence: a human puts their name to it and the AI's reasoning is attached to the file the person receives.
4. **The AI is plural.** No single model or vendor. At least two independently developed systems must agree on any decision above a set threshold of consequence, and their disagreements are published as a matter of course. Convergence is comforting; divergence is information.
5. **The Humaninity Audit.** A standing Assembly panel of 60, serving three-year staggered terms, whose only job is to go looking for places where the system is doing well on its metrics and badly by people. It has power to suspend any automated process for 90 days pending Assembly review. It is deliberately staffed by lot and not by technologists, because the thing it is auditing for is precisely the thing technologists are trained not to see.

### Role 3. The public has the final say (direct democracy)

**Normal times: quarterly.** Four referendum days a year, on fixed dates. The Assembly sets the questions; the Custodians run the vote; the information packet for each question is prepared by a lottery-selected Information Panel of 24 with the Custodian AI as drafting assistant and a published audit of every source used. Nothing goes to the public without the Information Panel certifying that the packet fairly states the strongest case on each side.

**War: emergency referendums.** The author is clear that this is a different regime and the stories are right to show it straining. When the Assembly has declared a state of armed conflict (itself a referendum question, with a 60 per cent threshold), it may call emergency referendums at any interval, including weekly, on questions of war and peace only. Everything else stays quarterly. The moral fatigue the stories describe is real and it is the cost of the design: a Republic that could go to war without asking is not a CLR. The alternative, a professional class deciding who dies while the public is spared the question, is the thing the whole model exists to prevent. The fatigue is not a bug to be smoothed away. It is the weight of sovereignty being felt by the people who hold it.

**Thresholds.** Ordinary referendum: simple majority. Constitutional change, Bill of Rights, structure of the Custodian layer, declaration of war: 60 per cent nationally and a majority in a majority of states (keeping Australia's section 128 shape). Removal of a judge or Custodian principal: 55 per cent. Repeal of a previous referendum result within five years: 60 per cent.

**Participation.** Compulsory, as Australian voting already is. The culture exists; the model borrows it rather than inventing it.

## The gaps, filled

### Who is the head of state?

**The Speaker of the Republic**, drawn by lot from among those who have *completed* an Assembly term in the previous ten years, and confirmed by the sitting Assembly on a two-thirds vote. Term: three years, non-renewable. The pool is former Assembly members because the role needs someone who has seen the system from the inside, and because it preserves the principle that no one reaches the top of the Republic by seeking it.

The Speaker's powers are deliberately few: to open and close the Assembly; to receive and formally sign laws and treaties into effect once the Assembly or the public has approved them; to represent the Republic abroad; to appoint, on the Judicial Commission's nomination and the Judicial Jury's confirmation, the judges; and, in one carefully bounded circumstance, to refuse. The Speaker may refuse to sign an instrument that has not followed the constitutional process (an Assembly vote without quorum; a referendum without a certified Information Panel packet) and must publish the reason. The Speaker may not refuse on the merits.

The author's requirement that the head of state must come from the lottery pool is honoured, and the thing that usually goes wrong with lottery heads of state (that they are unknown and have no standing) is handled by drawing from people who have already served.

### Who runs the judiciary?

The earlier documents gave this one sentence. The design here has four parts.

**Appointment.** A **Judicial Commission** of nine senior Custodian lawyers and judges nominates candidates for each vacancy, with published reasons and a published shortlist. A **Judicial Jury** of 36, drawn by lot and seated for the single purpose of filling that vacancy, hears the candidates in public over two weeks and confirms one on a two-thirds vote, or rejects the whole list and sends the Commission back. The Speaker appoints. This takes judicial appointment out of the hands of both politicians (who no longer exist) and the legal profession alone (which would otherwise appoint its own).

**Tenure and removal.** Judges serve to a fixed retirement age. They can be removed only by referendum, at 55 per cent, on a question put by a two-thirds Assembly vote. In practice this means almost never, which is what judicial independence is for.

**Interpretation of the Custodian limit.** The hardest question in the whole system is who decides whether a given Custodian act was *execution* (permitted) or *policy* (forbidden). It cannot be the Custodians. It should not be the ordinary courts alone, because the question is partly a question of political judgement. The design gives it to a **Constitutional Jury**: 48 citizens drawn by lot, serving staggered three-year terms, sitting with three judges of the highest court who advise but do not vote. Any citizen, any Assembly member, or any Custodian may bring a complaint. The Jury's finding that an act was policy voids the act and triggers Assembly review of the directorate responsible. Its findings are published with reasons. Over time its decisions form a body of precedent on where the line is, which is how any constitutional boundary actually gets defined.

**Ordinary courts.** Unchanged. The CLR is a design for the legislature and the executive. It leaves the common law alone.

### Who runs foreign affairs and treaties?

The author's rule: *Custodians for treaties, driven by requirements of the lottery pool.*

The Assembly adopts a **Foreign Requirement** for each relationship or negotiation: what the Republic wants, what it will not accept, what it is prepared to trade. The Custodian Directorate of External Affairs negotiates within that envelope, reports progress to the Assembly's External Panel in closed session (with the AI's full record available to the Panel), and brings back a text. The Assembly votes on the text. A treaty that commits the Republic to the use of force, cedes jurisdiction, or binds a future Assembly for more than ten years also goes to referendum. The Speaker signs. Withdrawal follows the same path in reverse.

Diplomacy needs confidentiality in the room and that is provided. What it does not get is the thing it has always had: the ability to commit a country to something its people did not ask for and would not have agreed to.

### Who manages a war?

The Assembly declares, by referendum at 60 per cent. A **War Panel** of 30 Assembly members, drawn from the sitting Assembly, sits continuously for the duration, receives daily briefings, and sets the Requirements the Defence Directorate executes. Emergency referendums go to the public as above. The War Panel's members are relieved and replaced in thirds every six months because what the stories call moral fatigue is also an operational risk. The Defence Directorate commands; the Panel instructs; the public decides whether to continue. No one in uniform is ever the one who decides to begin or to stop.

### How does it sit with the states?

Australia is a federation and nothing here requires changing that. A state may adopt the model (a state Assembly, a state Custodian service) independently, and that is in fact the implementation path the Australia document proposes. The federal design above assumes the Senate's protective function (a majority of states for constitutional questions) is preserved in the referendum thresholds. The states keep their own courts. Cross-jurisdiction issues are negotiated as they are now, Custodian-to-Custodian, under Requirements from each Assembly.

### What stops the Assembly itself becoming a class?

Three things. Ten-year ineligibility for re-service. No Assembly member may be employed by a Custodian directorate or by any body that has received a Custodian contract above a threshold for five years after their term. And the Assembly's own staff are Custodians, bound by the same transparency rules as everyone else, so an Assembly cannot build a private apparatus around itself.

## How the bodies fit together

| Body | Size | Selection | Term | What it does |
|---|---|---|---|---|
| The Assembly | 300 | Stratified lottery | 3 years, one-third rotating yearly | Sets agenda, adopts Requirements, passes ordinary law, puts questions to referendum |
| Standing panels of the Assembly | 20 to 60 each | From the Assembly, by lot | Duration of member's term | Supervise each Custodian directorate in public |
| Humaninity Audit | 60 | Stratified lottery | 3 years, staggered | Hunts for places the system is harming people while meeting its metrics; 90-day suspension power |
| Information Panels | 24 per question | Lottery | Life of the question | Certify referendum packets as fair |
| Judicial Jury | 36 per vacancy | Lottery | Life of the vacancy | Confirm or reject judicial nominees |
| Constitutional Jury | 48 + 3 advising judges | Lottery | 3 years, staggered | Rule on whether a Custodian act was execution or policy |
| War Panel | 30 | From the Assembly, by lot | Duration of conflict, rotating in thirds every 6 months | Instruct the Defence Directorate; frame emergency referendum questions |
| Speaker of the Republic | 1 | Lottery from former Assembly members, confirmed by Assembly | 3 years | Head of state; signs; refuses only on process |
| Custodian directorates | As needed | Merit appointment | Career, tenured | Execute Requirements; report; never initiate |
| Judicial Commission | 9 | Senior Custodian lawyers and judges | 6 years, staggered | Nominate judges |
| The public | Everyone | Birth or citizenship | Life | Quarterly referendums; emergency referendums in war; final say on constitution, rights, war and the Custodian layer itself |

Every body on this list that holds power over direction is chosen by lot. Every body chosen by merit is forbidden from holding power over direction. That is the whole design.

## Economics, deliberately brief

The archive hand-waves the economics and the author has said that is intentional: *within Australia, under a fair, just society, economics should and can be hand-waved.* I will keep it brief and say why that is defensible rather than lazy.

Australia is a continent-sized country of 27 million people with an extraordinary endowment of iron, gas, lithium, sunlight, wind, arable land and coastline, and it already runs a universal health system, a near-universal superannuation system, compulsory voting and a progressive income tax. The CLR's floor (universal housing, health and education; a caregiver income; income replacement for anyone serving on any lottery body) is a matter of political will and a resource-rent regime, not a matter of inventing wealth. Norway did the sovereign-wealth part fifty years ago. The question the CLR asks is not *can Australia afford to treat everyone decently* but *who gets to decide to*. The model's answer is: not the people who own the mines.

The one economic claim the model does need to defend is that removing elected politicians does not remove fiscal discipline. It does not. The Custodian Treasury reports in public to a standing panel, every budget passes through the Assembly as a Requirement, and the Humaninity Audit is as free to suspend a programme that is bankrupting the Republic as one that is harming a person. A lottery of ordinary householders is, if anything, more careful with money than a legislature of people who will not be there when the bill comes.

## What it borrows, and from whom

None of this is new. The archive's earlier documents cited only newDemocracy and two encyclopaedia pages, which made the model look more invented than it is. The design above sits on a substantial body of theory and a decade of real practice.

**Theory.**

- **David Van Reybrouck, *Against Elections: The Case for Democracy* (2016).** The clearest short argument that elections, not democracy, are what is exhausted, and that sortition was the democratic norm from Athens to Florence until the eighteenth century chose elections precisely because they produced an aristocracy. The CLR's Assembly is Van Reybrouck's "bi-representative" system taken to its conclusion.
- **Hélène Landemore, *Open Democracy: Reinventing Popular Rule for the Twenty-First Century* (2020).** Landemore argues from the epistemics: a cognitively diverse random sample makes better decisions than a selected elite, because diversity of perspective beats individual ability when problems are hard. Her "open mini-publics" with agenda-setting power are the closest existing design to the Assembly described here, and her insistence that the public, not experts, must set the agenda is the author's position in academic form.
- **Brett Hennig, *The End of Politicians: Time for a Real Democracy* (2017).** The practical manual. Hennig lays out how stratified sampling, facilitation and staged deliberation actually work, and why the quality of citizens' assembly output has repeatedly surprised the people who commissioned them.
- **Alexander Guerrero, "Against Elections: The Lottocratic Alternative," *Philosophy & Public Affairs* 42(2), 2014.** Guerrero proposes single-issue lottery legislatures, each with its own long-serving randomly selected members, as a way of getting depth without a political class. The CLR's standing panels and specialised juries (Constitutional, Judicial, War) borrow directly from this.

**Practice.**

- **The Irish Constitutional Convention (2012 to 2014) and Citizens' Assembly (2016 to 2018).** Sixty-six and then ninety-nine randomly selected citizens, with elected members in the first case, deliberated over months on questions the political class had avoided for decades. Their recommendations led directly to the 2015 marriage equality referendum and the 2018 referendum repealing the Eighth Amendment on abortion, both carried by large margins. This is the proof that a lottery body can set an agenda a legislature could not, and that the public will follow it.
- **The Ostbelgien Citizens' Council (Bürgerdialog), permanent since 2019.** The German-speaking Community of Belgium legislated a permanent, randomly selected citizens' council of 24, serving 18-month terms with one-third rotating every six months, with the power to set the agenda for ad hoc citizens' assemblies and to require the parliament to respond. It is the only permanent sortition body with agenda power in the world, and it is the direct model for the staggered terms used throughout this document. It has run for seven years without scandal, which is seven years longer than most parliaments manage.
- **The South Australian Nuclear Fuel Cycle Citizens' Jury (2016).** Three hundred and fifty randomly selected South Australians were asked whether the state should pursue a high-level nuclear waste facility recommended by a Royal Commission. Two-thirds said no, "under no circumstances." The government had expected a yes. This is in the list as a lesson, not a triumph: a lottery body will sometimes refuse the thing the experts want, and the system has to be built to accept that. In the CLR that refusal is the end of the matter until a future Assembly reopens it.
- **The City of Melbourne People's Panel (2014).** Forty-three randomly selected residents were given the city's ten-year, five-billion-dollar financial plan and asked what to do. Their recommendations (including rate rises and asset sales the council had been afraid to propose) were largely adopted. This is the Australian proof that ordinary people will make hard fiscal decisions when they are given real information and real responsibility, which is the premise the entire Custodian Treasury design rests on.

The CLR goes further than any of these: it makes the lottery body sovereign rather than advisory, adds a permanent AI-transparent executive, and gives the public the last word by referendum. But each step it takes is a step something real has already taken part of the way.

## What I still think is hard

I have tried to make the design honest about its costs. Three remain.

**The AI is a single point of trust.** Plural models, open logs and a lottery audit reduce the risk of capture; they do not remove it. A sufficiently sophisticated manipulation of the training or the objective function might not be visible to a panel of 60 citizens or to a second model trained on similar data. The Republic is betting that transparency plus diversity plus the Constitutional Jury is enough. It might not be. The Devil's Advocate's sixth section should be read as a standing warning, not a solved problem.

**Emergency referendums are a weapon pointed at the public's own morale.** A hostile power that understands the system will try to force a war of a thousand small decisions, each of which requires a vote, until the public tires and either votes to stop fighting or votes to stop voting. The War Panel's rotation and the restriction of emergency questions to war and peace only are the design's answer. The stories in this archive suggest it is a partial one.

**The Assembly can be wrong, and there is no one to blame.** In an electoral system a bad decision has an author who can be voted out. In a CLR, a bad decision was made by 300 of your neighbours who have since gone home. The system's bet is that the quality of decision goes up enough to pay for the loss of a scapegoat, and that a culture can be built in which the public owns its decisions rather than outsourcing responsibility for them. That culture does not exist yet anywhere. Building it is the actual project, and it is a longer one than any constitutional amendment.

## A closing note on tone

The earlier documents sometimes read as advocacy; the page that hosts them calls the whole thing a thought experiment. I have written this one as a design: here is a machine, here is what each part is for, here is where it might break. If it is a good design the reader does not need to be persuaded, and if it is a bad one persuasion should not help.

The author's purpose, as I understand it after this exercise, is not to say that this will happen. It is to say that a society which took the unexplainable value of each of its members as its first constitutional principle, and then built everything else to serve that, would look something like this, and that the pieces to build it with already exist. On that I think he is right.

## References

Guerrero, A. A. (2014). Against Elections: The Lottocratic Alternative. *Philosophy & Public Affairs*, 42(2), 135-178.

Hennig, B. (2017). *The End of Politicians: Time for a Real Democracy*. Unbound.

Landemore, H. (2020). *Open Democracy: Reinventing Popular Rule for the Twenty-First Century*. Princeton University Press.

Van Reybrouck, D. (2016). *Against Elections: The Case for Democracy* (L. Waters, Trans.). Bodley Head.

The Citizens' Assembly (Ireland). (2018). *Report and Recommendations on the Eighth Amendment of the Constitution*. https://citizensassembly.ie

Parlament der Deutschsprachigen Gemeinschaft. (2019). *Dekret zur Einführung eines permanenten Bürgerdialogs* (Ostbelgien Citizens' Council). https://www.buergerdialog.be

newDemocracy Foundation. (2016). *South Australia's Citizens' Jury on Nuclear Waste: Final Report*. https://www.newdemocracy.com.au

City of Melbourne. (2014). *People's Panel: Report to the Future Melbourne Committee on the 10-Year Financial Plan*. https://participate.melbourne.vic.gov.au
